# Pr0Plug

A Tampermonkey userscript that connects to Intiface Central and controls sex toys from any webpage, with automatic pattern generation based on image IDs.

## Features

- **Multi-device support**: Control multiple toys simultaneously
- **Multiple capabilities**: Vibrate, Rotate, Linear, Air, Oscillate
- **Auto Pattern**: Generates unique vibration patterns based on image/post IDs
- **Manual control**: Direct vibrate/stop buttons with intensity control
- **Per-device settings**: Individual min/max limits for each toy
- **Pattern visualization**: Live preview of generated patterns
- **Minimizable UI**: Collapsible control panel
- **Persistent settings**: All preferences saved in localStorage

## Requirements

- **Tampermonkey** browser extension
- **Intiface Central** running locally (default: `ws://127.0.0.1:12345`)
- Compatible sex toys connected via Intiface Central

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) for your browser
2. Open Tampermonkey dashboard
3. Create a new script and paste the contents of `proplug.js`
4. Save the script
5. Navigate to any webpage - the Pr0Plug panel should appear in the bottom-right corner

## Setup

1. **Install Intiface Central**: Download from [buttplug.io](https://buttplug.io/)
2. **Start Intiface Central**: Launch the application
3. **Connect toys**: Use Intiface Central to pair your devices
4. **Configure Pr0Plug**: Click "Connect" in the Pr0Plug panel

## Usage

### Basic Controls

- **Connect/Disconnect**: Toggle connection to Intiface Central
- **Scan**: Search for new devices
- **Strength**: Global intensity slider (0-100%)
- **Vibrate**: Manual activation of all enabled capabilities
- **Stop**: Stop all devices and auto patterns

### Auto Pattern

The Auto Pattern feature generates unique vibration patterns based on image/post IDs:

1. **Enable**: Check "Auto Pattern by Post ID"
2. **Pattern generation**: Each image ID creates a deterministic pattern
3. **Cycle duration**: Adjust pattern length (2-30 seconds)
4. **Visualization**: See pattern preview with active segment highlighting

### Advanced Settings

Open Advanced Settings to access:

#### Capabilities
- **Vibrate**: Standard vibration control
- **Rotate**: Rotational movement (speed-based)
- **Linear**: Positional movement (stroke-style between min/max)
- **Air**: Suction/pressure control
- **Oscillate**: Oscillation patterns

#### Per-Device Limits
- **Min/Max sliders**: Set intensity limits for each device
- **Linear behavior**: Min/Max define stroke endpoints (not intensity range)

### Pattern Customization

- **Cycle Duration**: 2-30 seconds (slider control)
- **Intensity scaling**: Patterns respect global strength slider
- **Per-device limits**: Each device's min/max settings are applied

## Configuration

### WebSocket URL
Override the default Intiface Central connection:
```javascript
localStorage.setItem('tm_buttplug_ws', 'ws://127.0.0.1:12345');
```

### Capability Defaults
All capabilities are enabled by default. Settings persist in localStorage under `bp_caps_v1`.

### Pattern Duration
Default cycle duration is 12 seconds. Adjustable via UI slider, persisted in localStorage.

## Device Support

Pr0Plug automatically detects device capabilities through Intiface Central's message attributes:

- **VibrateCmd**: Standard vibration
- **RotateCmd**: Rotational control
- **LinearCmd**: Positional movement
- **AirCmd**: Air pressure/suction
- **OscillateCmd**: Oscillation patterns

## Technical Details

### Pattern Generation
- Uses seeded random number generator (xorshift32) with image ID as seed
- Generates 8-13 segments per pattern
- Segment duration: 350-1250ms
- Intensity bias: Mid-high range with power curve

### Linear Movement
- Alternates between device's min/max positions
- Duration scales with intensity (faster = shorter duration)
- Per-device stroke range defined by min/max sliders

### URL Detection
- Extracts numeric ID from URL pathname
- Supports various URL formats (e.g., `/new/12345`, `/post/67890`)
- Auto-updates on navigation (SPA support)

## Troubleshooting

### "No enabled capabilities match connected devices"
- Check that capability toggles are enabled in Advanced Settings
- Verify devices are properly connected in Intiface Central
- Ensure device capabilities are detected (check device list)

### Connection Issues
- Verify Intiface Central is running
- Check WebSocket URL (default: `ws://127.0.0.1:12345`)
- Try different port if using custom Intiface setup

### Pattern Not Working
- Ensure Auto Pattern is enabled
- Check that a valid post ID is detected (shown in UI)
- Verify at least one capability is enabled and device supports it

## Browser Compatibility

- Chrome/Chromium (recommended)
- Firefox
- Edge
- Safari (with Tampermonkey)

## License

This project is provided as-is for educational and personal use.

## Contributing

Feel free to submit issues or feature requests. The script is designed to be easily modifiable for different websites and use cases.

## Disclaimer

This software is intended for adults only. Use responsibly and ensure all participants consent to any activities involving connected devices.
