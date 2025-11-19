"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SshConfigParser = void 0;
const fs = require("fs");
const path = require("path");
const os = require("os");
class SshConfigParser {
    constructor() { }
    parse(configPath) {
        const resolvedPath = this.resolveHome(configPath);
        if (!fs.existsSync(resolvedPath)) {
            return [];
        }
        const content = fs.readFileSync(resolvedPath, 'utf8');
        const lines = content.split('\n');
        const hosts = [];
        let currentHost = null;
        for (let line of lines) {
            line = line.trim();
            if (!line || line.startsWith('#')) {
                continue;
            }
            const parts = line.split(/\s+/);
            const key = parts[0].toLowerCase();
            const value = parts.slice(1).join(' ');
            if (key === 'host') {
                // Support multiple patterns? For now just take the first one if multiple are listed, or create multiple entries?
                // Spec says "list of servers". Usually "Host *" is not a server.
                // Let's skip wildcards for now or handle them carefully.
                // "Host web01 web02" -> creates two entries?
                // For simplicity, let's assume one host per Host line or handle the first one.
                // Actually, standard ssh config allows multiple patterns.
                // Let's iterate over patterns.
                const patterns = parts.slice(1);
                for (const pattern of patterns) {
                    if (pattern.includes('*') || pattern.includes('?')) {
                        continue; // Skip wildcards
                    }
                    currentHost = { host: pattern };
                    hosts.push(currentHost);
                }
            }
            else if (currentHost) {
                if (key === 'hostname') {
                    currentHost.hostname = value;
                }
                else if (key === 'user') {
                    currentHost.user = value;
                }
                else if (key === 'identityfile') {
                    currentHost.identityFile = value;
                }
            }
        }
        return hosts;
    }
    resolveHome(filepath) {
        if (filepath.startsWith('~')) {
            return path.join(os.homedir(), filepath.slice(1));
        }
        return filepath;
    }
}
exports.SshConfigParser = SshConfigParser;
//# sourceMappingURL=sshConfig.js.map