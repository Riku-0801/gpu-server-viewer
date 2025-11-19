"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GpuViewPanel = void 0;
const vscode = require("vscode");
const gpuMonitor_1 = require("./gpuMonitor");
const serverProvider_1 = require("./serverProvider");
class GpuViewPanel {
    constructor(panel, extensionUri, host) {
        this._disposables = [];
        // History state: host -> gpuIndex -> history[]
        this._memoryHistory = new Map();
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._host = host;
        this._monitor = new gpuMonitor_1.GpuMonitor();
        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'refresh':
                    this._update();
                    return;
                case 'connect':
                    vscode.commands.executeCommand('gpu-server-viewer.connectSsh', message.host);
                    return;
            }
        }, null, this._disposables);
        // Auto-refresh every 5 seconds
        this._timer = setInterval(() => this._update(), 5000);
    }
    static createOrShow(extensionUri, host) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        // If we already have a panel, show it.
        // Note: We might want to support multiple panels for different servers.
        // For now, let's just replace the current one or create a new one if it's a different host?
        // Or allow multiple? The spec doesn't strictly say. "Tabs" implies standard VSCode tabs.
        // Let's allow multiple panels.
        const title = host ? `GPU: ${host}` : 'GPU Dashboard';
        const panel = vscode.window.createWebviewPanel('gpuView', title, column || vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'resources')]
        });
        new GpuViewPanel(panel, extensionUri, host);
    }
    dispose() {
        GpuViewPanel.currentPanel = undefined;
        if (this._timer) {
            clearInterval(this._timer);
        }
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
    async _update() {
        const webview = this._panel.webview;
        try {
            let data = [];
            if (this._host) {
                try {
                    const gpus = await this._monitor.getGpuStatus(this._host);
                    this._updateHistory(this._host, gpus);
                    data.push({ host: this._host, gpus });
                }
                catch (e) {
                    data.push({ host: this._host, gpus: [], error: e.message });
                }
            }
            else {
                // Dashboard mode: fetch all
                const hosts = serverProvider_1.GpuServerProvider.getHosts();
                const promises = hosts.map(async (h) => {
                    try {
                        const gpus = await this._monitor.getGpuStatus(h.host);
                        this._updateHistory(h.host, gpus);
                        return { host: h.host, gpus };
                    }
                    catch (e) {
                        return { host: h.host, gpus: [], error: e.message };
                    }
                });
                data = await Promise.all(promises);
            }
            this._panel.webview.html = this._getHtmlForWebview(webview, data);
        }
        catch (error) {
            // Should not happen if we catch individual errors above, but just in case
            this._panel.webview.html = this._getHtmlForWebview(webview, [], error);
        }
    }
    _updateHistory(host, gpus) {
        if (!this._memoryHistory.has(host)) {
            this._memoryHistory.set(host, new Map());
        }
        const hostHistory = this._memoryHistory.get(host);
        const now = Date.now();
        gpus.forEach(gpu => {
            if (!hostHistory.has(gpu.index)) {
                hostHistory.set(gpu.index, []);
            }
            const history = hostHistory.get(gpu.index);
            // Parse memory used/total (assuming "1234 MiB" format)
            const used = parseInt(gpu.memory.used.replace(/\D/g, '')) || 0;
            const total = parseInt(gpu.memory.total.replace(/\D/g, '')) || 0;
            history.push({ timestamp: now, used, total });
            // Keep last 60 points (5 minutes at 5s interval)
            if (history.length > 60) {
                history.shift();
            }
        });
    }
    _getHtmlForWebview(webview, data, globalError) {
        const isDashboard = !this._host;
        const title = this._host ? `GPU: ${this._host}` : 'GPU Dashboard';
        const content = this._getContent(data, globalError, isDashboard);
        return this._getWebviewContent(title, content, isDashboard);
    }
    _getContent(data, globalError, isDashboard) {
        if (globalError) {
            return `<div class="error"><h3>Error fetching GPU status</h3><p>${globalError.message}</p></div>`;
        }
        if (data.length === 0) {
            return `<div>No servers found. Please check your SSH configuration or extension settings.</div>`;
        }
        const serverCards = data.map(server => this._getServerCardHtml(server, isDashboard)).join('');
        return `<div class="dashboard-grid">${serverCards}</div>`;
    }
    _getServerCardHtml(server, isDashboard) {
        let serverContent = '';
        if (server.error) {
            serverContent = `<div class="error">Error: ${server.error}</div>`;
        }
        else if (server.gpus.length === 0) {
            serverContent = `<div>No GPUs found.</div>`;
        }
        else {
            serverContent = server.gpus.map(gpu => this._getGpuCardHtml(gpu, isDashboard)).join('');
        }
        return `
        <div class="server-card">
            <div class="header" style="margin-bottom: 5px;">
                <h2>${server.host}</h2>
                <button onclick="connect('${server.host}')">Connect</button>
            </div>
            ${serverContent}
        </div>
        `;
    }
    _getGpuCardHtml(gpu, isDashboard) {
        const memUsed = parseFloat(gpu.memory.used.replace(/\D/g, ''));
        const memTotal = parseFloat(gpu.memory.total.replace(/\D/g, ''));
        const memPercent = (memUsed / memTotal) * 100;
        let details = '';
        if (!isDashboard) {
            details = `
            <div class="stat-row">
                <span>GPU: ${gpu.utilization.gpu}</span>
                <span>Temp: ${gpu.temperature.gpu}</span>
            </div>
            <div class="stat-row">
                <span>Mem Util: ${gpu.utilization.memory}</span>
            </div>
            `;
        }
        return `
        <div class="gpu-card">
            <h3>${gpu.name} [${gpu.index}]</h3>
            ${details}
            <div style="margin-top: 4px;">
                <div class="memory-text">Mem: ${gpu.memory.used} / ${gpu.memory.total}</div>
                <div class="bar-container">
                    <div class="bar" style="width: ${memPercent}%"></div>
                </div>
            </div>
        </div>
        `;
    }
    _getWebviewContent(title, content, isDashboard) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
            <style>${this._getCss(isDashboard)}</style>
        </head>
        <body>
            <div class="header">
                <h1>${title}</h1>
                <button onclick="refresh()">Refresh</button>
            </div>
            ${content}
            <script>
                const vscode = acquireVsCodeApi();
                function refresh() {
                    vscode.postMessage({ command: 'refresh' });
                }
                function connect(host) {
                    vscode.postMessage({ command: 'connect', host: host });
                }
            </script>
        </body>
        </html>`;
    }
    _getCss(isDashboard) {
        const gridColumns = isDashboard ? '1fr 1fr' : '1fr';
        return `
            body { font-family: sans-serif; padding: 10px; background-color: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
            .dashboard-grid { display: grid; grid-template-columns: ${gridColumns}; gap: 10px; }
            .server-card { border: 1px solid var(--vscode-widget-border); padding: 10px; border-radius: 5px; background-color: var(--vscode-editor-widget-background); }
            .gpu-card { border: 1px solid var(--vscode-widget-border); padding: 8px; margin-top: 8px; border-radius: 3px; background-color: var(--vscode-editor-background); }
            .bar-container { background-color: var(--vscode-widget-shadow); height: 8px; width: 100%; border-radius: 4px; overflow: hidden; margin-top: 4px; }
            .bar { height: 100%; background-color: var(--vscode-charts-blue); }
            .error { color: var(--vscode-errorForeground); }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
            button { padding: 4px 8px; cursor: pointer; background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 2px; }
            button:hover { background-color: var(--vscode-button-hoverBackground); }
            h1 { font-size: 1.2em; margin: 0; }
            h2 { font-size: 1em; margin: 0; }
            h3 { font-size: 0.9em; margin: 0 0 4px 0; }
            .stat-row { display: flex; justify-content: space-between; font-size: 0.85em; margin-bottom: 2px; }
            .memory-text { font-size: 0.85em; }
        `;
    }
}
exports.GpuViewPanel = GpuViewPanel;
//# sourceMappingURL=gpuView.js.map