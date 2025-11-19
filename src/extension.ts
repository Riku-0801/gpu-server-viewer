import * as vscode from 'vscode';
import { GpuServerProvider } from './serverProvider';
import { GpuViewPanel } from './gpuView';
import { SshConfigParser } from './sshConfig';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "gpu-server-viewer" is now active!');

    const serverProvider = new GpuServerProvider();
    vscode.window.registerTreeDataProvider('gpuServerList', serverProvider);

    context.subscriptions.push(
        vscode.commands.registerCommand('gpu-server-viewer.refresh', () => serverProvider.refresh()),
        vscode.commands.registerCommand('gpu-server-viewer.addServer', () => vscode.window.showInformationMessage('Add Server not implemented yet.')),
        vscode.commands.registerCommand('gpu-server-viewer.openServer', (host: string) => {
            GpuViewPanel.createOrShow(context.extensionUri, host);
        }),
        vscode.commands.registerCommand('gpu-server-viewer.openDashboard', () => {
            GpuViewPanel.createOrShow(context.extensionUri, undefined);
        }),
        vscode.commands.registerCommand('gpu-server-viewer.connectSsh', (item: any) => {
            let host = '';
            if (typeof item === 'string') {
                host = item;
            } else if (item && item.host) {
                host = item.host;
            } else {
                return;
            }

            vscode.commands.executeCommand('vscode.newWindow', {
                remoteAuthority: `ssh-remote+${host}`
            });
        }),
        vscode.commands.registerCommand('gpu-server-viewer.configureServers', async () => {
            const config = vscode.workspace.getConfiguration('gpu-server-viewer');
            const configPath = config.get<string>('sshConfigPath') || '~/.ssh/config';
            const targets = config.get<string[]>('targets') || [];
            const ignored = config.get<string[]>('ignoredHosts') || [];

            const parser = new SshConfigParser();
            const allHosts = parser.parse(configPath);

            // Filter by targets if set
            let candidates = allHosts;
            if (targets.length > 0) {
                candidates = allHosts.filter((h: any) => targets.includes(h.host));
            }

            const items: vscode.QuickPickItem[] = candidates.map((h: any) => ({
                label: h.host,
                picked: !ignored.includes(h.host)
            }));

            const selected = await vscode.window.showQuickPick(items, {
                canPickMany: true,
                placeHolder: 'Select servers to show'
            });

            if (selected) {
                const selectedHosts = selected.map(s => s.label);
                // Ignored hosts are those NOT in selectedHosts
                const newIgnored = candidates
                    .map((h: any) => h.host)
                    .filter((h: any) => !selectedHosts.includes(h));
                
                await config.update('ignoredHosts', newIgnored, vscode.ConfigurationTarget.Global);
                serverProvider.refresh();
            }
        })
    );

    // Open dashboard on activation
    vscode.commands.executeCommand('gpu-server-viewer.openDashboard');
}

export function deactivate() {}
