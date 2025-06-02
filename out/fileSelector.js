"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileSelector = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class FileSelector {
    context;
    panel;
    constructor(context) {
        this.context = context;
    }
    /**
     * Show the file selector UI
     */
    async showFileSelectorUI() {
        // Create a webview panel
        this.panel = vscode.window.createWebviewPanel('quicksendCode2AI', 'Share Files with AI', vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this.context.extensionPath, 'src', 'webview'))
            ]
        });
        // Get the workspace files
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace is open');
            return;
        }
        // Get all files in the workspace recursively
        const files = await this.getAllWorkspaceFiles(workspaceFolders[0].uri.fsPath);
        // Load the HTML content
        this.panel.webview.html = this.getWebviewContent(files, this.panel.webview);
        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'shareFiles':
                    await this.processSelectedFiles(message.files);
                    break;
            }
        }, undefined, this.context.subscriptions);
    }
    /**
     * Get all files in the workspace
     * No filtering - includes all file types
     */
    async getAllWorkspaceFiles(dir) {
        const files = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            // Skip node_modules and .git directories
            if (entry.isDirectory()) {
                if (entry.name !== 'node_modules' && entry.name !== '.git') {
                    const subDirFiles = await this.getAllWorkspaceFiles(fullPath);
                    files.push(...subDirFiles);
                }
            }
            else {
                // Include ALL files without any filtering
                files.push(fullPath);
            }
        }
        return files;
    }
    /**
     * Process the selected files
     */
    async processSelectedFiles(selectedFilePaths) {
        try {
            let formattedContent = '';
            // Get the workspace folder path
            const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
            console.log('Workspace folder:', workspaceFolder);
            console.log('Selected files:', selectedFilePaths);
            for (const relativePath of selectedFilePaths) {
                // Build the absolute path
                const absolutePath = path.join(workspaceFolder, relativePath);
                console.log('Processing file:', relativePath);
                console.log('Absolute path:', absolutePath);
                try {
                    // Check if file exists
                    if (fs.existsSync(absolutePath)) {
                        const content = fs.readFileSync(absolutePath, 'utf8');
                        const fileName = path.basename(absolutePath);
                        const fileExt = path.extname(absolutePath).substring(1); // Remove the dot
                        // Format the content for Claude
                        formattedContent += `# File: ${fileName}\n`;
                        formattedContent += `\`\`\`${fileExt}\n`;
                        formattedContent += content;
                        formattedContent += '\n```\n\n';
                        console.log(`Successfully read file: ${fileName}`);
                    }
                    else {
                        console.log(`File does not exist: ${absolutePath}`);
                        vscode.window.showWarningMessage(`File not found: ${relativePath}`);
                    }
                }
                catch (fileError) { // Type assertion to any for backward compatibility
                    console.error(`Error reading file ${relativePath}:`, fileError);
                    const errorMessage = fileError instanceof Error ? fileError.message : String(fileError);
                    vscode.window.showWarningMessage(`Error reading file ${relativePath}: ${errorMessage}`);
                }
            }
            if (formattedContent) {
                // Copy to clipboard
                await vscode.env.clipboard.writeText(formattedContent);
                // vscode.window.showInformationMessage('Files formatted and copied to clipboard. You can now paste them to Claude.');
            }
            else {
                vscode.window.showErrorMessage('No valid files were found to process.');
            }
        }
        catch (error) { // Type assertion to any
            console.error('Error in processSelectedFiles:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Error processing files: ${errorMessage}`);
        }
    }
    /**
     * Generate the webview HTML content
     * Modified to handle all file types with appropriate icons and support for dark mode
     */
    getWebviewContent(files, webview) {
        // Convert absolute paths to relative paths for the UI
        const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const relativeFiles = files.map(file => path.relative(workspaceFolder, file));
        // Group files by directory for better organization
        const filesByDirectory = {};
        relativeFiles.forEach(file => {
            const directory = path.dirname(file);
            if (!filesByDirectory[directory]) {
                filesByDirectory[directory] = [];
            }
            filesByDirectory[directory].push(file);
        });
        return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>QuickClaude File Share</title>
        <style>
          :root {
            /* Orange Color Palette */
            --primary-orange: #FF5F15;
            --primary-orange-zerofix: rgba(255, 95, 21, 0.02);
            --orange-hover: #E04700;
            --light-orange: #FFF0E8;
            --orange-accent: #FF8C42;
            --soft-orange: #FF7F45;
            
            /* Theme-aware colors using VSCode CSS variables */
            --app-bg: var(--vscode-editor-background);
            --panel-bg: var(--vscode-sideBar-background, #f3f3f3);
            --header-bg: var(--vscode-titleBar-activeBackground, #f3f3f3);
            --item-hover-bg: rgba(255, 95, 21, 0.1);
            --border-color: var(--vscode-widget-border, #e5e5e5);
            --text-color: var(--vscode-foreground, #333333);
            --text-secondary: var(--vscode-descriptionForeground, #717171);
            --input-bg: var(--vscode-input-background, #ffffff);
            --input-border: var(--vscode-input-border, #e5e5e5);
            --directory-header-bg: var(--vscode-sideBarSectionHeader-background, #f3f3f3);
            --checkbox-bg: var(--vscode-checkbox-background, #ffffff);
            --btn-default-bg: var(--vscode-button-secondaryBackground, #f3f3f3);
            --btn-default-text: var(--vscode-button-secondaryForeground, #333333);
            --btn-default-hover: var(--vscode-button-secondaryHoverBackground, #e5e5e5);
            --btn-primary-bg: var(--primary-orange);
            --btn-primary-text: white;
            --btn-primary-hover: var(--orange-hover);
            --tooltip-bg: var(--vscode-editorHoverWidget-background, rgba(26, 26, 26, 0.9));
            --tooltip-text: var(--vscode-editorHoverWidget-foreground, white);
            --scrollbar-track: var(--vscode-scrollbarSlider-background, rgba(100, 100, 100, 0.2));
            --scrollbar-thumb: rgba(255, 95, 21, 0.3);
            --scrollbar-thumb-hover: rgba(255, 95, 21, 0.5);
            --shadow-color: rgba(0, 0, 0, 0.1);
            --directory-group-bg: var(--vscode-editor-background);
            --file-list-bg: var(--vscode-editor-background);
          }
          
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          }
          
          body {
            padding: 0;
            margin: 0;
            color: var(--text-color);
            background-color: var(--app-bg);
            line-height: 1.5;
            height: 100vh;
            width: 100vw;
            overflow: hidden;
          }
          
          .app-container {
            width: 100%;
            height: 100vh;
            display: flex;
            flex-direction: column;
            background: var(--app-bg);
          }
          
          .app-header {
            background: var(--header-bg);
            padding: 16px 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            position: relative;
            border-bottom: 1px solid var(--border-color);
          }
          
          .header-left {
            display: flex;
            align-items: center;
          }
          
          .logo {
            font-size: 1.2em;
            font-weight: 600;
            display: flex;
            align-items: center;
          }
          
          .logo-icon {
            margin-right: 10px;
            font-size: 1.3em;
          }
          
          .logo-text {
            font-weight: 600;
            letter-spacing: -0.01em;
            color: var(--primary-orange);
          }
          
          .app-subtitle {
            font-size: 0.9em;
            font-weight: normal;
            opacity: 0.9;
            margin-left: 15px;
            color: var(--text-color);
          }
          
          .header-right {
            font-size: 0.85em;
            opacity: 0.8;
          }

          .search-bar {
            padding: 16px 24px;
            position: relative;
            background: var(--panel-bg);
            border-bottom: 1px solid var(--border-color);
          }
          
          .search-input {
            width: 100%;
            padding: 10px 16px 10px 38px;
            border-radius: 6px;
            border: 1px solid var(--input-border);
            background-color: var(--input-bg);
            color: var(--text-color);
            font-size: 14px;
            outline: none;
            transition: all 0.2s;
          }
          
          .search-input:focus {
            border-color: var(--primary-orange);
            box-shadow: 0 0 0 2px rgba(255, 95, 21, 0.2);
          }
          
          .search-icon {
            position: absolute;
            left: 36px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-secondary);
          }
          
          .file-container {
            flex: 1;
            padding: 0;
            overflow-y: auto;
            background-color: var(--app-bg);
          }
          
          .file-count {
            padding: 12px 24px;
            color: var(--text-secondary);
            font-size: 13px;
            letter-spacing: 0.01em;
            border-bottom: 1px solid var(--primary-orange);
            background: var(--panel-bg);
            position: sticky;
            top: -15px;
            z-index: 7;
            transition: all 0.3s ease-out;
          }
          
          .directories-wrapper {
            padding: 16px 24px;
            height: max-content;
            background-color: var(--app-bg);
          }
          
          .directory-group {
            margin-bottom: 16px;
            overflow: hidden;
            border-radius: 8px;
            border: 1px solid var(--border-color);
            background: var(--directory-group-bg);
            transition: box-shadow 0.3s;
          }
          
          .directory-group:hover {
            box-shadow: 0 4px 12px rgba(255, 95, 21, 0.08);
          }
          
          .directory-header {
            background: var(--directory-header-bg);
            padding: 12px 16px;
            cursor: pointer;
            user-select: none;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid var(--border-color);
            transition: background-color 0.2s;
          }
          
          .directory-header:hover {
            background: var(--item-hover-bg);
          }
          
          .directory-name {
            font-weight: 500;
            font-size: 14px;
            color: var(--text-color);
            display: flex;
            align-items: center;
          }
          
          .directory-path {
            font-size: 12px;
            color: var(--text-secondary);
            margin-left: 8px;
          }
          
          .file-list {
            max-height: 300px;
            overflow-y: auto;
            padding: 8px 0;
            background: var(--file-list-bg);
          }
          
          .file-item {
            display: flex;
            align-items: center;
            padding: 7px 16px;
            transition: all 0.15s;
            cursor: pointer;
            border-radius: 4px;
            margin: 2px 8px;
          }
          
          .file-item:hover {
            background: var(--item-hover-bg);
          }
          
          .file-checkbox {
            appearance: none;
            width: 18px;
            height: 18px;
            border: 1.5px solid var(--border-color);
            border-radius: 4px;
            margin-right: 12px;
            position: relative;
            cursor: pointer;
            transition: all 0.2s;
            background-color: var(--checkbox-bg);
          }
          
          .file-checkbox:checked {
            background-color: var(--primary-orange);
            border-color: var(--primary-orange);
          }
          
          .file-checkbox:checked::after {
            content: "";
            position: absolute;
            top: 2px;
            left: 5px;
            width: 4px;
            height: 8px;
            border: solid white;
            border-width: 0 2px 2px 0;
            transform: rotate(45deg);
          }
          
          .file-item label {
            margin-left: 4px;
            cursor: pointer;
            font-size: 13px;
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            padding: 2px 0;
            color: var(--text-color);
          }
          
          .file-icon {
            margin-right: 8px;
            font-size: 14px;
          }
          
          .actions-panel {
            background: var(--panel-bg);
            padding: 16px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1px solid var(--border-color);
            box-shadow: 0 -4px 12px var(--shadow-color);
          }
          
          .selection-actions {
            display: flex;
            gap: 10px;
          }
          
          .btn {
            padding: 8px 16px;
            border-radius: 6px;
            border: none;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.15s;
            outline: none;
          }
          
          .btn-default {
            background-color: var(--btn-default-bg);
            color: var(--btn-default-text);
            border: 1px solid var(--border-color);
          }
          
          .btn-default:hover {
            background-color: var(--btn-default-hover);
          }
          
          .btn-primary {
            background-color: var(--btn-primary-bg);
            color: var(--btn-primary-text);
          }
          
          .btn-primary:hover {
            background-color: var(--btn-primary-hover);
          }
          
          .btn-primary:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
          
          .selected-count {
            font-size: 13px;
            color: var(--text-secondary);
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .count-badge {
            background-color: var(--primary-orange);
            color: white;
            border-radius: 12px;
            padding: 2px 8px;
            font-size: 12px;
            font-weight: 500;
          }
          
          .tooltip {
            position: relative;
            display: inline-block;
          }
          
          .tooltip-text {
            visibility: hidden;
            background: var(--tooltip-bg);
            color: var(--tooltip-text);
            text-align: center;
            border-radius: 6px;
            padding: 6px 10px;
            position: absolute;
            z-index: 1;
            bottom: 125%;
            left: 50%;
            transform: translateX(-50%);
            opacity: 0;
            transition: opacity 0.2s, transform 0.2s;
            font-size: 12px;
            white-space: nowrap;
            font-weight: 400;
            box-shadow: 0 4px 12px var(--shadow-color);
          }
          
          .tooltip:hover .tooltip-text {
            visibility: visible;
            opacity: 1;
            transform: translateX(-50%) translateY(-5px);
          }

          /* Animation for copied notification */
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }

          @keyframes fadeOut {
            from { opacity: 1; transform: translateY(0); }
            to { opacity: 0; transform: translateY(-20px); }
          }

          .notification {
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: var(--primary-orange);
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            box-shadow: 0 4px 15px rgba(255, 95, 21, 0.25);
            display: flex;
            align-items: center;
            gap: 10px;
            animation: fadeIn 0.3s ease-out, fadeOut 0.3s ease-in 2.7s forwards;
            z-index: 1000;
            font-weight: 500;
          }

          .spinner {
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top: 2px solid white;
            width: 14px;
            height: 14px;
            animation: spin 1s linear infinite;
          }

          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          /* Modern scrollbar */
          .file-list::-webkit-scrollbar,
          .directories-wrapper::-webkit-scrollbar {
            width: 8px;
          }

          .file-list::-webkit-scrollbar-track,
          .directories-wrapper::-webkit-scrollbar-track {
            background: var(--scrollbar-track);
            border-radius: 10px;
          }

          .file-list::-webkit-scrollbar-thumb,
          .directories-wrapper::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb);
            border-radius: 10px;
          }

          .file-list::-webkit-scrollbar-thumb:hover,
          .directories-wrapper::-webkit-scrollbar-thumb:hover {
            background: var(--scrollbar-thumb-hover);
          }

          /* Responsive styles */
          @media (max-width: 600px) {
            .app-header {
              flex-direction: column;
              align-items: flex-start;
            }
            
            .app-subtitle {
              margin-left: 0;
              margin-top: 5px;
            }
            
            .header-right {
              display: none;
            }
            
            .actions-panel {
              flex-direction: column;
              gap: 12px;
            }
            
            .selection-actions {
              width: 100%;
              justify-content: space-between;
            }
          }
        </style>
      </head>
      <body>
        <div class="app-container">
          <div class="app-header">
            <div class="header-left">
              <div class="logo">
                <span class="logo-icon"></span>
                <span class="logo-text">QuickSend Code2AI</span>
              </div>
              <div class="app-subtitle">Select files to share with AI assistants</div>
            </div>
            <div class="header-right">

            </div>
          </div>
          
          <div class="search-bar">
            <span class="search-icon">🔍</span>
            <input type="text" class="search-input" id="search-input" placeholder="Search files..." />
          </div>
          
          <div class="file-container">
            <div class="file-count">
              <span id="total-count">${relativeFiles.length}</span> files found
            </div>
            
            <div class="directories-wrapper">
              ${Object.keys(filesByDirectory).sort().map(directory => {
            const dirFiles = filesByDirectory[directory];
            const dirName = directory === '.' ? 'Root Directory' : directory;
            return `
                <div class="directory-group">
                  <div class="directory-header" data-directory="${directory}">
                    <div class="directory-name">📁 ${dirName} <span class="directory-path">(${dirFiles.length} files)</span></div>
                    <span class="directory-toggle">▼</span>
                  </div>
                  <div class="file-list" data-directory="${directory}">
                    ${dirFiles.map((file, index) => {
                const fileName = path.basename(file);
                const fileExt = path.extname(fileName).toLowerCase();
                // Assign file icons based on extension
                let fileIcon = '📄';
                if (['.js', '.jsx'].includes(fileExt))
                    fileIcon = '🟨';
                if (['.ts', '.tsx'].includes(fileExt))
                    fileIcon = '🟦';
                if (['.html'].includes(fileExt))
                    fileIcon = '🌐';
                if (['.css', '.scss'].includes(fileExt))
                    fileIcon = '🎨';
                if (['.json'].includes(fileExt))
                    fileIcon = '📊';
                if (['.py'].includes(fileExt))
                    fileIcon = '🐍';
                if (['.java'].includes(fileExt))
                    fileIcon = '☕';
                if (['.c', '.cpp', '.h'].includes(fileExt))
                    fileIcon = '⚙️';
                if (['.md', '.markdown'].includes(fileExt))
                    fileIcon = '📝';
                if (['.txt'].includes(fileExt))
                    fileIcon = '📄';
                if (['.xml', '.svg'].includes(fileExt))
                    fileIcon = '🔖';
                if (['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(fileExt))
                    fileIcon = '🖼️';
                if (['.pdf'].includes(fileExt))
                    fileIcon = '📑';
                if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(fileExt))
                    fileIcon = '🗜️';
                if (['.mp3', '.wav', '.ogg', '.flac'].includes(fileExt))
                    fileIcon = '🎵';
                if (['.mp4', '.avi', '.mov', '.wmv'].includes(fileExt))
                    fileIcon = '🎬';
                if (['.doc', '.docx'].includes(fileExt))
                    fileIcon = '📘';
                if (['.xls', '.xlsx'].includes(fileExt))
                    fileIcon = '📊';
                if (['.ppt', '.pptx'].includes(fileExt))
                    fileIcon = '📊';
                if (['.exe', '.dll', '.so', '.bin'].includes(fileExt))
                    fileIcon = '⚙️';
                if (['.sh', '.bash', '.zsh', '.fish'].includes(fileExt))
                    fileIcon = '📜';
                if (['.sql'].includes(fileExt))
                    fileIcon = '💾';
                if (['.yml', '.yaml'].includes(fileExt))
                    fileIcon = '⚙️';
                if (['.csv'].includes(fileExt))
                    fileIcon = '📊';
                // Add more file type icons as needed
                return `
                      <div class="file-item">
                        <input type="checkbox" id="file-${index}" class="file-checkbox" data-path="${file}">
                        <span class="file-icon">${fileIcon}</span>
                        <label for="file-${index}" title="${file}">${fileName}</label>
                      </div>
                      `;
            }).join('')}
                  </div>
                </div>
                `;
        }).join('')}
            </div>
          </div>
          
          <div class="actions-panel">
            <div class="selected-count">
              Selected: <span class="count-badge" id="count">0</span>
            </div>
            
            <div class="selection-actions">
              <button id="selectAll" class="btn btn-default">Select All</button>
              <button id="deselectAll" class="btn btn-default">Deselect All</button>
              <div class="tooltip">
                <button id="shareButton" class="btn btn-primary">Format & Copy</button>
                <span class="tooltip-text">Copy selected files in Claude format</span>
              </div>
            </div>
          </div>
        </div>

        <script>
          (function() {
            const vscode = acquireVsCodeApi();
            const fileCheckboxes = document.querySelectorAll('.file-checkbox');
            const selectAllBtn = document.getElementById('selectAll');
            const deselectAllBtn = document.getElementById('deselectAll');
            const shareButton = document.getElementById('shareButton');
            const countElement = document.getElementById('count');
            const searchInput = document.getElementById('search-input');
            const directoryHeaders = document.querySelectorAll('.directory-header');
            
            // Update count badge
            function updateCount() {
              const count = document.querySelectorAll('.file-checkbox:checked').length;
              countElement.textContent = count;
              
              // Disable/enable share button based on selection
              if (count === 0) {
                shareButton.disabled = true;
              } else {
                shareButton.disabled = false;
              }
            }
            
            // Initialize
            updateCount();
            
            // Toggle directory expand/collapse
            directoryHeaders.forEach(header => {
              header.addEventListener('click', () => {
                const directory = header.getAttribute('data-directory');
                // Use string concatenation instead of template literals
                const fileList = document.querySelector('.file-list[data-directory="' + directory + '"]');
                const toggle = header.querySelector('.directory-toggle');
                
                if (fileList.style.display === 'none') {
                  fileList.style.display = 'block';
                  toggle.textContent = '▼';
                } else {
                  fileList.style.display = 'none';
                  toggle.textContent = '▶';
                }
              });
            });
            
            // Search functionality
            searchInput.addEventListener('input', () => {
              const searchTerm = searchInput.value.toLowerCase();
              
              fileCheckboxes.forEach(checkbox => {
                const fileItem = checkbox.closest('.file-item');
                const fileName = fileItem.querySelector('label').textContent.toLowerCase();
                const filePath = checkbox.getAttribute('data-path').toLowerCase();
                
                if (fileName.includes(searchTerm) || filePath.includes(searchTerm)) {
                  fileItem.style.display = 'flex';
                  
                  // Ensure parent directory is visible
                  const directoryGroup = fileItem.closest('.directory-group');
                  const fileList = fileItem.closest('.file-list');
                  fileList.style.display = 'block';
                  directoryGroup.querySelector('.directory-toggle').textContent = '▼';
                } else {
                  fileItem.style.display = 'none';
                }
              });
            });
            
            // Add event listeners to checkboxes
            fileCheckboxes.forEach(checkbox => {
              checkbox.addEventListener('change', updateCount);
            });
            
            // Select all files
            selectAllBtn.addEventListener('click', () => {
              // Only select visible files
              document.querySelectorAll('.file-item:not([style*="display: none"]) .file-checkbox').forEach(checkbox => {
                checkbox.checked = true;
              });
              updateCount();
            });
            
            // Deselect all files
            deselectAllBtn.addEventListener('click', () => {
              fileCheckboxes.forEach(checkbox => {
                checkbox.checked = false;
              });
              updateCount();
            });
            
            // Share selected files
            shareButton.addEventListener('click', () => {
              const selectedFiles = [];
              
              document.querySelectorAll('.file-checkbox:checked').forEach(checkbox => {
                const filePath = checkbox.getAttribute('data-path');
                if (filePath) {
                  selectedFiles.push(filePath);
                }
              });
              
              if (selectedFiles.length === 0) {
                alert('Please select at least one file');
                return;
              }
              
              // Show loading state
              shareButton.innerHTML = '<div class="spinner"></div> Processing...';
              shareButton.disabled = true;
              
              vscode.postMessage({
                command: 'shareFiles',
                files: selectedFiles
              });
              
              // Create and show notification
              setTimeout(() => {
                // Restore button state
                shareButton.innerHTML = 'Format & Copy';
                shareButton.disabled = false;
                
                // Create notification
                const notification = document.createElement('div');
                notification.className = 'notification';
                notification.innerHTML = '✅ Files copied to clipboard successfully! Ready to paste to your AI assistant.';
                document.body.appendChild(notification);
                
                // Remove notification after animation
                setTimeout(() => {
                  notification.remove();
                }, 3000);
              }, 800);
            });
          })();
        </script>
      </body>
      </html>
    `;
    }
}
exports.FileSelector = FileSelector;
//# sourceMappingURL=fileSelector.js.map