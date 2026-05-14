# MMM-GetShellScript

A MagicMirror² module that adds HTTP endpoints to your MagicMirror installation for executing predefined shell scripts. Allowing you to trigger actions on your MagicMirror via HTTP requests from other devices or automation systems like Home Assistant, Node-RED, or IFTTT.

## Features

- Adds custom HTTP endpoints to your MagicMirror (Supports multiple enpoints and scripts in a single config)
- Executes predefined shell scripts when endpoints are called
- Supports authentication via token (global or per-route)
- Passes query parameters from the HTTP request to the script as command-line arguments
- Logs execution results on the MagicMirror display (optional), persisted across browser and server restarts
- Configurable execution timeout (hung scripts are killed automatically)
- Optional per-route cooldown  (prevents a route from being triggered too rapidly)
- No production dependencies (uses MagicMirror's built-in Express server)


## Buy me a coffee

I'm an overworked and underpaid tech worker in the analytics and intelligence industry. I spend my free time creating and sharing side projects like MagicMirror modules and 3D printing STL files with the community. If you enjoy my work and want to support future projects, buy me a coffee! ☕

[Buy me a coffee](https://buymeacoffee.com/uphillcheddar)


## Installation

```bash
cd ~/MagicMirror/modules
git clone https://github.com/uphillcheddar/MMM-GetShellScript.git
cd MMM-GetShellScript
npm install
```

`npm install` has no production dependencies to download. It runs a `postinstall` script that does `chmod +x scripts/*.sh` as a convenience so your bundled scripts are immediately executable. If you manage script permissions yourself you can skip it.


## Configuration

### Multi-Script Configuration

Define multiple routes and scripts in a single module instance. Each route can optionally override any global setting:

```javascript
{
  module: "MMM-GetShellScript",
  position: "bottom_right",
  config: {
    // Global settings (can be overridden per script)
    authToken: "CHANGE-THIS-TO-A-SECRET-TOKEN",
    requireAuth: true,
    showLogs: true,
    maxLogEntries: 10,
    scriptTimeout: 30000,  // ms before a hung script is killed (default: 30000)
    cooldownSeconds: 0,    // minimum seconds between calls, 0 = disabled (default: 0)

    scripts: [
      {
        route: "/night",
        scriptPath: "modules/MMM-GetShellScript/scripts/night_time.sh",
        authToken: "night-token",    // optional: overrides global authToken
        requireAuth: true,           // optional: overrides global requireAuth
        cooldownSeconds: 5           // optional: overrides global cooldownSeconds
      },
      {
        route: "/day",
        scriptPath: "modules/MMM-GetShellScript/scripts/day_time.sh"
        // uses all global settings
      },
      {
        route: "/reboot",
        scriptPath: "modules/MMM-GetShellScript/scripts/reboot.sh",
        scriptTimeout: 10000         // optional: overrides global scriptTimeout
      }
    ]
  }
},
```

### Single-Script Configuration (Legacy)

The original single-script format is still fully supported:

```javascript
{
  module: "MMM-GetShellScript",
  position: "bottom_right",
  config: {
    route: "/execute",
    authToken: "CHANGE-THIS-TO-A-SECRET-TOKEN",
    scriptPath: "modules/MMM-GetShellScript/scripts/sample.sh",
    requireAuth: true,
    showLogs: true,
    maxLogEntries: 10,
    scriptTimeout: 30000,
    cooldownSeconds: 0
  }
},
```

### Configuration Options

| Option | Description | Default |
|---|---|---|
| `route` | HTTP endpoint path (legacy single-script) | `/night` |
| `scriptPath` | Path to script relative to MagicMirror root | `modules/MMM-GetShellScript/scripts/example.sh` |
| `authToken` | Token required in the `?token=` query param | `your-secret-token` |
| `requireAuth` | Whether to enforce token authentication | `true` |
| `showLogs` | Show execution history on the mirror display | `true` |
| `maxLogEntries` | Number of log entries to display and persist | `10` |
| `scriptTimeout` | Milliseconds before a running script is killed | `30000` |
| `cooldownSeconds` | Minimum seconds between calls to a route; `0` disables | `0` |
| `scripts` | Array of script configs for multi-script mode | `[]` |

### IP Whitelist

For the module to accept requests from other devices, add your network to MagicMirror's `ipWhitelist` in `config.js`:

```javascript
ipWhitelist: [
  "127.0.0.1",
  "::ffff:127.0.0.1",
  "::1",
  "10.0.0.0/24",        // adjust to your network or vlan as needed
  "::ffff:10.0.0.0/24" // ipv6 version
],
```


## Usage

### Calling the Endpoint

```
http://your-mirror-ip:8080/night?token=your-secret-token
http://your-mirror-ip:8080/day?token=your-secret-token&brightness=50
```

Responses:
- `200` — script ran successfully
- `401` — wrong or missing token
- `429` — cooldown active (response includes seconds remaining)
- `500` — script not found or execution failed

### Passing Parameters

All query parameters except `token` are forwarded to your script as command-line arguments in `--key=value` format. Only alphanumeric, dash, and underscore key names are accepted.

For example:
```
http://your-mirror-ip:8080/execute?token=secret&action=refresh&brightness=50
```

Your script receives:
```bash
/path/to/your/script.sh --action=refresh --brightness=50
```

### Creating Custom Scripts

1. Create your script in the `scripts` directory
2. Make it executable: `chmod +x your-script.sh`  
   (or re-run `npm install` in the module directory to chmod everything in `scripts/`)
3. Point your config's `scriptPath` at it

Scripts run as the same user as MagicMirror. Avoid storing credentials inside scripts (use environment variables or a secrets file with restricted permissions instead.)


## Integration with Home Assistant

### rest_command setup

```yaml
rest_command:
  magic_mirror_night:
    url: "http://your-mirror-ip:8080/night?token=night-token"
    method: GET

  magic_mirror_day:
    url: "http://your-mirror-ip:8080/day?token=day-token"
    method: GET

  magic_mirror_reboot:
    url: "http://your-mirror-ip:8080/reboot?token=your-secret-token"
    method: GET
```

### Automation example

```yaml
automation:
  - alias: "Magic Mirror Night Mode"
    trigger:
      platform: time
      at: "22:00:00"
    action:
      service: rest_command.magic_mirror_night

  - alias: "Magic Mirror Day Mode"
    trigger:
      platform: time
      at: "07:00:00"
    action:
      service: rest_command.magic_mirror_day
```


## Security Considerations

- **Change the default token** — the default `authToken` is public; replace it with a strong, unique value before exposing any route
- **Use the IP whitelist** — restrict `ipWhitelist` in MagicMirror's `config.js` to only the devices that need access
- **Tokens are in URLs** — query-string tokens appear in server logs and browser history; avoid reusing them for sensitive accounts
- **Scripts run as the MagicMirror user** — anything a script can do, an attacker with your token can do; keep scripts tightly scoped
- **Use `cooldownSeconds`** for routes that trigger disruptive actions (reboots, display changes) to limit repeated triggering


## Troubleshooting

**"Cannot GET /your-route"**
- Confirm the module is loaded and the route in config matches your URL
- Check the MagicMirror console for startup errors

**401 Authentication Failed**
- Verify the `?token=` value matches `authToken` in your config exactly

**429 Cooldown Active**
- The route was called too recently; wait the indicated number of seconds, or set `cooldownSeconds: 0` to disable

**500 Script execution failed**
- Check the MagicMirror console for the specific error
- Confirm the script path is correct relative to the MagicMirror root directory
- Verify the script is executable (`chmod +x your-script.sh`)
- If the script times out, increase `scriptTimeout` or investigate why the script hangs

**Execution history not showing**
- Confirm `showLogs: true` is set and the module has a position configured
- `logs.json` in the module directory stores the history, if it gets corupted or you wish to clear history delete it and it will be recreated


## License

MIT
