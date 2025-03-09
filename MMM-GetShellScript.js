/**
 * Magic Mirror Module: MMM-GetShellScript
 * This module adds an API endpoint to your MagicMirror installation.
 */

Module.register("MMM-GetShellScript", {
    defaults: {
        route: "/night",
        authToken: "change-this-token",
        scriptPath: "modules/MMM-GetShellScript/scripts/example.sh",
        requireAuth: true,
        showLogs: true,
        maxLogEntries: 10,
    },

    logs: [],

    getDom: function() {
        const wrapper = document.createElement("div");
        if (!this.config.showLogs) return wrapper;
        
        wrapper.className = "small";
        
        if (this.logs.length === 0) {
            wrapper.innerHTML = "No executions yet.";
            return wrapper;
        }
        
        const table = document.createElement("table");
        table.className = "small";
        
        this.logs.forEach(log => {
            const row = document.createElement("tr");
            
            const timeCell = document.createElement("td");
            timeCell.innerHTML = log.time;
            timeCell.className = "dimmed";
            row.appendChild(timeCell);
            
            const statusCell = document.createElement("td");
            statusCell.innerHTML = log.success ? "✓" : "✗";
            statusCell.className = log.success ? "bright" : "dimmed";
            row.appendChild(statusCell);
            
            table.appendChild(row);
        });
        
        wrapper.appendChild(table);
        return wrapper;
    },

    start: function() {
        Log.info("Starting module: " + this.name);
        this.sendSocketNotification("SETUP_ENDPOINT", this.config);
    },

    socketNotificationReceived: function(notification, payload) {
        if (notification === "SCRIPT_EXECUTED") {
            this.logs.unshift({
                time: new Date().toLocaleTimeString(),
                success: payload.success
            });
            
            if (this.logs.length > this.config.maxLogEntries) {
                this.logs = this.logs.slice(0, this.config.maxLogEntries);
            }
            
            this.updateDom();
            this.sendNotification("SHELL_SCRIPT_EXECUTED", payload);
        }
    }
});