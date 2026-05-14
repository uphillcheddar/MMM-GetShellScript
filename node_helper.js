/**
 * Node Helper for MMM-GetShellScript
 */

const NodeHelper = require("node_helper");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");

module.exports = NodeHelper.create({
    start: function() {
        console.log("Starting node helper for: " + this.name);
        this.scriptConfigs = {};
        this.registeredRoutes = new Set();
        this.lastExecuted = {};
        this.logs = [];
        this.logsPath = path.join(__dirname, "logs.json");
        this.loadLogs();
    },

    loadLogs: function() {
        try {
            if (fs.existsSync(this.logsPath)) {
                const data = fs.readFileSync(this.logsPath, "utf8");
                this.logs = JSON.parse(data);
            }
        } catch (err) {
            console.error("MMM-GetShellScript: Failed to load logs:", err);
            this.logs = [];
        }
    },

    saveLogs: function() {
        try {
            fs.writeFileSync(this.logsPath, JSON.stringify(this.logs), "utf8");
        } catch (err) {
            console.error("MMM-GetShellScript: Failed to save logs:", err);
        }
    },

    socketNotificationReceived: function(notification, payload) {
        if (notification === "SETUP_ENDPOINT") {
            this.config = payload;
            this.setupRoutes();
            const maxEntries = this.config.maxLogEntries || 10;
            this.sendSocketNotification("LOGS_LOADED", this.logs.slice(0, maxEntries));
        }
    },

    setupRoutes: function() {
        let scriptsToSetup = [];

        if (this.config.scripts && this.config.scripts.length > 0) {
            scriptsToSetup = this.config.scripts.map(script => ({
                route: script.route,
                scriptPath: script.scriptPath,
                authToken: script.authToken || this.config.authToken,
                requireAuth: script.requireAuth !== undefined ? script.requireAuth : this.config.requireAuth,
                cooldownSeconds: script.cooldownSeconds !== undefined ? script.cooldownSeconds : (this.config.cooldownSeconds || 0),
                scriptTimeout: script.scriptTimeout || this.config.scriptTimeout || 30000
            }));
        } else {
            scriptsToSetup = [{
                route: this.config.route,
                scriptPath: this.config.scriptPath,
                authToken: this.config.authToken,
                requireAuth: this.config.requireAuth,
                cooldownSeconds: this.config.cooldownSeconds || 0,
                scriptTimeout: this.config.scriptTimeout || 30000
            }];
        }

        scriptsToSetup.forEach(scriptConfig => {
            // Always update the stored config so token/path changes take effect on reconnect
            this.scriptConfigs[scriptConfig.route] = scriptConfig;

            // Only register the Express route handler once
            if (this.registeredRoutes.has(scriptConfig.route)) {
                return;
            }
            this.registeredRoutes.add(scriptConfig.route);

            const scriptPath = path.resolve(global.root_path + "/" + scriptConfig.scriptPath);

            const scriptsDir = path.dirname(scriptPath);
            if (!fs.existsSync(scriptsDir)) {
                fs.mkdirSync(scriptsDir, { recursive: true });
                console.log(`MMM-GetShellScript: Created scripts directory at ${scriptsDir}`);
            }

            // Make executable once at setup, not on every request
            if (fs.existsSync(scriptPath)) {
                try {
                    fs.chmodSync(scriptPath, "755");
                } catch (err) {
                    console.error(`MMM-GetShellScript: Error making script executable: ${err}`);
                }
            }

            this.expressApp.get(scriptConfig.route, (req, res) => {
                this.handleRequest(req, res, scriptConfig.route);
            });

            console.log(`MMM-GetShellScript: Registered route ${scriptConfig.route} -> ${scriptConfig.scriptPath}`);
        });
    },

    handleRequest: function(req, res, route) {
        const scriptConfig = this.scriptConfigs[route];
        if (!scriptConfig) {
            return res.status(500).send("Internal configuration error");
        }

        if (scriptConfig.requireAuth) {
            const token = req.query.token;
            if (token !== scriptConfig.authToken) {
                console.log(`MMM-GetShellScript: Auth failed for ${route}`);
                return res.status(401).send("Authentication failed");
            }
        }

        if (scriptConfig.cooldownSeconds > 0) {
            const now = Date.now();
            const last = this.lastExecuted[route] || 0;
            if (now - last < scriptConfig.cooldownSeconds * 1000) {
                const remaining = Math.ceil((scriptConfig.cooldownSeconds * 1000 - (now - last)) / 1000);
                return res.status(429).send(`Cooldown active, try again in ${remaining}s`);
            }
        }
        this.lastExecuted[route] = Date.now();

        const params = {};
        Object.keys(req.query).forEach(key => {
            if (key !== "token") params[key] = req.query[key];
        });

        this.executeScript(scriptConfig, params, (success, output, error) => {
            if (success) {
                res.send("Script executed successfully: " + output);
            } else {
                res.status(500).send("Script execution failed: " + error);
            }

            const logEntry = {
                time: new Date().toLocaleTimeString(),
                route: route,
                success: success
            };
            const maxEntries = (this.config && this.config.maxLogEntries) || 10;
            this.logs.unshift(logEntry);
            if (this.logs.length > maxEntries) {
                this.logs = this.logs.slice(0, maxEntries);
            }
            this.saveLogs();

            this.sendSocketNotification("SCRIPT_EXECUTED", {
                route: route,
                success: success,
                output: output,
                error: error
            });
        });
    },

    executeScript: function(scriptConfig, params, callback) {
        const scriptPath = path.resolve(global.root_path + "/" + scriptConfig.scriptPath);

        if (!fs.existsSync(scriptPath)) {
            console.error(`MMM-GetShellScript: Script not found: ${scriptPath}`);
            return callback(false, null, "Script not found");
        }

        // Build args array — avoids shell interpretation of param values entirely
        const args = [];
        Object.keys(params).forEach(key => {
            // Reject keys that aren't safe identifiers to avoid mangling the arg format
            if (/^[a-zA-Z0-9_-]+$/.test(key)) {
                args.push(`--${key}=${params[key]}`);
            }
        });

        console.log(`MMM-GetShellScript: Executing ${scriptPath} with args:`, args);

        execFile(scriptPath, args, { timeout: scriptConfig.scriptTimeout }, (error, stdout, stderr) => {
            if (error) {
                const isTimeout = error.killed || error.code === null;
                const msg = isTimeout ? "Script timed out" : (stderr || error.toString());
                console.error(`MMM-GetShellScript: Execution error: ${msg}`);
                callback(false, stdout, msg);
            } else {
                console.log("MMM-GetShellScript: Script executed successfully");
                callback(true, stdout, stderr);
            }
        });
    }
});
