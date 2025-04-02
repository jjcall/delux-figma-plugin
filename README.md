# Wirefy - Figma Wireframe Converter Plugin

A Figma plugin that automatically converts your detailed UI designs into clean, professional wireframes. Wirefy helps designers quickly create wireframe versions of their designs while maintaining the original layout and structure.

## Features

- **One-Click Conversion**: Transform any frame into a wireframe with a single click
- **Smart Element Detection**: Intelligently handles different types of elements:
  - Text elements preserve their original size and position
  - Icons are converted to a consistent style
  - Containers maintain their structure and hierarchy
  - Navigation elements preserve their functionality indicators
- **Consistent Styling**:
  - Clean, monochromatic color scheme
  - Uniform border treatment
  - Consistent spacing and alignment
  - Smart handling of fills and transparencies
- **Original Design Preservation**:
  - Maintains layout and positioning
  - Preserves text auto-resize behavior
  - Keeps important structural elements
  - Respects original opacity settings

## Installation

1. Open Figma and go to the plugins menu
2. Search for "Wirefy" in the plugin marketplace
3. Click "Install"

## Usage

1. Select the frame you want to convert
2. Right-click and select Plugins > Wirefy
3. Click "Convert to Wireframe"
4. Your wireframe will be created as a new frame next to the original

## Development Setup

```bash
# Clone the repository
git clone [repository-url]
cd wirefy

# Install dependencies
npm install

# Build the plugin
npm run build

# Watch for changes during development
npm run watch
```

### Prerequisites

- Node.js (v14 or higher)
- Figma desktop app for testing
- Figma plugin development environment

## Project Structure

```
wirefy/
├── src/               # Source files
│   ├── code.ts       # Main plugin logic
│   ├── ui.tsx        # Plugin UI components
│   └── ui.css        # UI styles
├── build/            # Compiled files
├── tasks/            # Development tasks and documentation
└── manifest.json     # Plugin manifest
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Figma Plugin API Documentation
- The Figma community for feedback and support

## Contact

Project Link: [repository-url]

## Roadmap

- [ ] Custom wireframe styles
- [ ] Batch processing for multiple frames
- [ ] Annotation tools
- [ ] Performance optimization for large files
- [ ] Component library integration