"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerTreeItem = exports.GpuServerProvider = void 0;
const vscode = require("vscode");
const sshConfig_1 = require("./sshConfig");
class GpuServerProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (element) {
            return Promise.resolve([]);
        }
        const items = [];
        // Add Dashboard item
        const dashboardItem = new vscode.TreeItem('Dashboard', vscode.TreeItemCollapsibleState.None);
        dashboardItem.iconPath = new vscode.ThemeIcon('dashboard');
        dashboardItem.command = {
            command: 'gpu-server-viewer.openDashboard',
            title: 'Open Dashboard'
        };
        dashboardItem.contextValue = 'dashboard';
        items.push(dashboardItem);
        const displayHosts = GpuServerProvider.getHosts();
        const serverItems = displayHosts.map(h => new ServerTreeItem(h.host, vscode.TreeItemCollapsibleState.None));
        return Promise.resolve([...items, ...serverItems]);
    }
    static getHosts() {
        const config = vscode.workspace.getConfiguration('gpu-server-viewer');
        const configPath = config.get('sshConfigPath') || '~/.ssh/config';
        const targets = config.get('targets') || [];
        const ignoredHosts = config.get('ignoredHosts') || [];
        const parser = new sshConfig_1.SshConfigParser();
        const allHosts = parser.parse(configPath);
        let displayHosts = allHosts;
        if (targets.length > 0) {
            displayHosts = allHosts.filter(h => targets.includes(h.host));
        }
        if (ignoredHosts.length > 0) {
            displayHosts = displayHosts.filter(h => !ignoredHosts.includes(h.host));
        }
        return displayHosts;
    }
}
exports.GpuServerProvider = GpuServerProvider;
class ServerTreeItem extends vscode.TreeItem {
    constructor(host, collapsibleState) {
        super(host, collapsibleState);
        this.host = host;
        this.collapsibleState = collapsibleState;
        this.tooltip = `SSH Host: ${host}`;
        this.description = ''; // Could show status here later
        this.contextValue = 'server';
        this.command = {
            command: 'gpu-server-viewer.openServer',
            title: 'Open GPU View',
            arguments: [this.host]
        };
        this.iconPath = new vscode.ThemeIcon('server');
    }
}
exports.ServerTreeItem = ServerTreeItem;
//# sourceMappingURL=serverProvider.js.map