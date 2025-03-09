/**
 * Node Helper for MMM-GetShellScript
 */

const NodeHelper = require("node_helper");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const url = require("url");

module.exports = NodeHelper.create({
    start: function() {
        console.log("Starting node helper for: " + this.name);
    },
    
    socketNotificationReceived: function(notification, payload) {
        if (notification === "SETUP_ENDPOINT") {
            this.config = payload;
            this.setupRoute();
            console.log(`MMM-GetShellScript has set up route: ${this.config.route}`);
        }
    },
    
    // Set up the route using MagicMirror's existing express app
    setupRoute: function() {
        const self = this;
        
        // Create scripts directory if it doesn't exist
        const scriptsDir = path.dirname(path.resolve(global.root_path + "/" + this.config.scriptPath));
        if (!fs.existsSync(scriptsDir)) {
            fs.mkdirSync(scriptsDir, { recursive: true });
            console.log(`Created scripts directory at ${scriptsDir}`);
        }
        
        // Register the route handler
        this.expressApp.get(this.config.route, (req, res) => {
            console.log(`Received request at ${this.config.route}`);
            this.handleRequest(req, res);
        });
    },
    
    handleRequest: function(req, res) {
        console.log("Processing request...");
        
        // Check authentication if required
        if (this.config.requireAuth) {
            const query = url.parse(req.url, true).query;
            const token = query.token;
            
            if (token !== this.config.authToken) {
                console.log("Authentication failed");
                return res.status(401).send("Authentication failed");
            }
        }
        
        // Get any parameters
        const params = {};
        const query = url.parse(req.url, true).query;
        Object.keys(query).forEach(key => {
            if (key !== "token") {
                params[key] = query[key];
            }
        });
        
        this.executeScript(params, (success, output, error) => {
            if (success) {
                res.send("Script executed successfully: " + output);
            } else {
                res.status(500).send("Script execution failed: " + error);
            }
            
            this.sendSocketNotification("SCRIPT_EXECUTED", {
                success: success,
                output: output,
                error: error
            });
        });
    },
    
    executeScript: function(params, callback) {
        const scriptPath = path.resolve(global.root_path + "/" + this.config.scriptPath);
        
        // Check if the script exists
        if (!fs.existsSync(scriptPath)) {
            console.error(`Script not found: ${scriptPath}`);
            return callback(false, null, "Script not found");
        }
        
        // Make sure the script is executable
        try {
            fs.chmodSync(scriptPath, "755");
        } catch (err) {
            console.error(`Error making script executable: ${err}`);
            return callback(false, null, "Error making script executable");
        }
        
        // Build the command with parameters
        let command = scriptPath;
        
        // Add parameters as command line arguments
        Object.keys(params).forEach(key => {
            command += ` --${key}="${params[key]}"`;
        });
        
        console.log(`Executing: ${command}`);
        
        // Execute the script
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Execution error: ${error}`);
                callback(false, stdout, stderr || error.toString());
            } else {
                console.log(`Script executed successfully`);
                callback(true, stdout, stderr);
            }
        });
    }
});