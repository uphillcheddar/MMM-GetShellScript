# MMM-GetShellScript

A MagicMirror² module that adds a simple HTTP endpoint to your MagicMirror installation for executing predefined shell scripts. This allows you to trigger actions on your MagicMirror via HTTP requests from other devices or automation systems like Home Assistant, Node-RED, or IFTTT.

## Features

- Adds a custom HTTP endpoint to your MagicMirror
- Executes a predefined shell script when the endpoint is called
- Supports authentication via token
- Passes parameters from the HTTP request to the script
- Logs execution results on the MagicMirror display (optional)
- Works with both GET and POST requests

## Installation

```bash
cd ~/MagicMirror/modules
git clone https://github.com/uphillcheddar/MMM-GetShellScript.git
cd MMM-GetShellScript
npm install
```

## Configuration

Add the module to your `config/config.js` file:

```javascript
{
  module: "MMM-GetShellScript",
  position: "bottom_right", // Can be any position or "none" to hide
  config: {
    route: "/execute",  // The HTTP endpoint path
    authToken: "CHANGE-THIS-TO-A-SECRET-TOKEN", // Authentication token
    scriptPath: "modules/MMM-GetShellScript/scripts/sample.sh", // Path to your script, if using default install this should work, just add/replace your script in the module's subfolder
    requireAuth: true,  // Whether to require authentication
    showLogs: true,     // Whether to show execution logs on the mirror
    maxLogEntries: 10   // Maximum number of log entries to display
  }
},
```

### Important: IP Whitelist Configuration

For the module to accept external requests, you need to modify your MagicMirror's IP whitelist in the main `config.js` file:

```javascript
ipWhitelist: [
  "127.0.0.1", 
  "::ffff:127.0.0.1", 
  "::1", 
  "10.0.0.0/24",       // Allow all IPs in this subnet (adjust to your network)
  "::ffff:10.0.0.0/24"  // IPv6 equivalent
],
```

## Usage

### Calling the HTTP Endpoint

You can call the endpoint using a simple GET request:

```
http://your-mirror-ip:8080/execute?token=your-secret-token&action=refresh
```

Or with a POST request:

```bash
curl -X POST http://your-mirror-ip:8080/execute \
  -H "Content-Type: application/json" \
  -d '{"token":"your-secret-token","action":"refresh"}'
```

### Creating Custom Scripts

1. Create your scripts in the `scripts` directory
2. Make them executable with `chmod +x your-script.sh`
3. Update your module config to point to your script
(note that the npm install script automatically makes anything in the scripts subfolder executable so if you are uncomfortable with chmod just run npm install again )

## Integration with Home Assistant 

Home assistant is optional but its why i made this modules so including this for others if needed 


Step 1
Add to your Home Assistant `configuration.yaml`:

```yaml
rest_command:
  magic_mirror_execute:
    url: "http://your-mirror-ip:8080/execute?token=your-secret-token&action=refresh"
    method: GET
```

Then call it from an automation/script example calls it at 22 local time every day:

```yaml
automation:
  - alias: "Magic Mirror Night Mode"
    trigger:
      platform: time
      at: "22:00:00"
    action:
      service: rest_command.magic_mirror_execute
```

## Security Considerations

- Always change the default `authToken` to a strong, unique token
- Consider using HTTPS if exposing your MagicMirror to the internet
- Be careful when writing scripts that accept parameters
- Only include IP addresses you trust in the whitelist

## Supported Parameters

The module passes all query parameters or POST body properties to your script as command-line arguments in the format `--key="value"`. For example, if you call:

```
http://your-mirror-ip:8080/execute?token=secret&action=refresh&brightness=50
```

Your script will receive:

```
--token="secret" --action="refresh" --brightness="50"
```

## Troubleshooting

If you receive a "Cannot GET /execute" error:
- Check that your MagicMirror is running
- Verify that the module is loaded correctly (check the console logs)
- Make sure your IP address is in the `ipWhitelist` in the MagicMirror config
- Confirm that the route in your config matches the URL you're using

## License

MIT
