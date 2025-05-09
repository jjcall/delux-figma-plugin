interface Message {
  type: 'convert-to-wireframe' | 'help' | 'convert' | 'close';
  fontChoice?: 'handwritten' | 'sans-serif' | 'serif';
  themeChoice?: 'mono' | 'blueprint' | 'dark-mode';
  useRoundedCorners?: boolean;
}

figma.showUI(__html__, {
  themeColors: true,
  width: 240,
  height: 370,
});

// Theme definitions
type ThemeColors = {
  content: RGB;
  contentLight: RGB;
  fill: RGB;
  fillInverted: RGB;
  stroke: RGB;
  background: RGB;
}

// Define the different color themes
const themes = {
  'mono': {
    content: { r: 0.2, g: 0.2, b: 0.2 },           // Dark gray (#333333) for text and icons
    contentLight: { r: 0.95, g: 0.95, b: 0.95 },   // light gray (#f2f2f2) for text on dark backgrounds
    fill: { r: 0.9, g: 0.9, b: 0.9 },              // light gray (#e6e6e6) for fills
    fillInverted: { r: 0.25, g: 0.25, b: 0.25 },   // dark gray (#404040) for dark backgrounds
    stroke: { r: 0.6, g: 0.6, b: 0.6 },            // Medium gray (#999999) for borders
    background: { r: 1, g: 1, b: 1 }               // White (#FFFFFF) for backgrounds
  },
  'blueprint': {
    content: { r: 1, g: 1, b: 1 },                 // White (#FFFFFF) for text and icons
    contentLight: { r: 0.81, g: 0.85, b: 0.97 },   // Light blue/lavender (#CED8F7) for text on dark backgrounds
    fill: { r: 0.29, g: 0.43, b: 0.9 },            // Medium-bright blue (#4A6DE5) for fills
    fillInverted: { r: 0, g: 0.13, b: 0.51 },      // Deep navy blue (#002082) for dark backgrounds
    stroke: { r: 0.81, g: 0.85, b: 0.97 },         // Light blue/lavender (#CED8F7) for borders
    background: { r: 0.19, g: 0.34, b: 0.88 }      // Medium-dark blue (#3057E1) for backgrounds
  },
  'dark-mode': {
    content: { r: 0.9, g: 0.9, b: 0.9 },           // Light gray (#E6E6E6) for text and icons
    contentLight: { r: 0.2, g: 0.2, b: 0.2 },      // Dark gray (#333333) for text on light backgrounds
    fill: { r: 0.24, g: 0.24, b: 0.24 },           // Medium-dark gray (#3D3D3D) for fills
    fillInverted: { r: 0.75, g: 0.75, b: 0.75 },   // Light gray (#BFBFBF) for light backgrounds
    stroke: { r: 0.4, g: 0.4, b: 0.4 },            // Medium gray (#666666) for borders
    background: { r: 0.1, g: 0.1, b: 0.1 }         // Almost black (#1A1A1A) for backgrounds
  }
} as const;

type ThemeOption = keyof typeof themes;

// Core wireframe styles structure
type WireframeStylesType = {
  colors: ThemeColors;
  strokes: {
    default: number;
    border: number;
  };
  text: {
    font: FontName;
  };
  radius: number;
  applyRadius: boolean;
}

// Function to get wireframe styles for a specific theme
function getWireframeStyles(themeChoice: ThemeOption, fontChoice: FontName, useRoundedCorners: boolean): WireframeStylesType {
  return {
    colors: themes[themeChoice],
    strokes: {
      default: 1,
      border: 0.5
    },
    text: {
      font: fontChoice
    },
    radius: 8,  // Default border radius for non-ellipse elements
    applyRadius: useRoundedCorners
  };
}

// Font mapping
const fontMapping = {
  'handwritten': { family: "Figma Hand", style: "Regular" },
  'sans-serif': { family: "Helvetica", style: "Regular" },
  'serif': { family: "Times New Roman", style: "Regular" }
} as const;

type FontOption = keyof typeof fontMapping;

// Type guards for node types
function isFrameNode(node: SceneNode): node is FrameNode {
  return node.type === 'FRAME';
}

function isTextNode(node: SceneNode): node is TextNode {
  return node.type === 'TEXT';
}

function isShapeNode(node: SceneNode): node is RectangleNode | EllipseNode | PolygonNode {
  return ['RECTANGLE', 'ELLIPSE', 'POLYGON'].includes(node.type);
}

function isVectorNode(node: SceneNode): node is VectorNode {
  return node.type === 'VECTOR';
}

function hasChildren(node: SceneNode): node is FrameNode | ComponentNode | InstanceNode {
  return 'children' in node;
}

// Helper function to check if a node is an icon container
function isIconContainer(node: SceneNode): boolean {
  return node.name.toLowerCase().includes('iconbutton') ||
         (node.name.toLowerCase().includes('icon') && hasChildren(node));
}

// Helper function to check if a node is a tab container
function isTabContainer(node: SceneNode): boolean {
  return node.name.toLowerCase().includes('tab') && !node.name.toLowerCase().includes('button');
}

// Helper function to check if a node is an individual tab
function isTab(node: SceneNode): boolean {
  return node.name.toLowerCase() === 'tab' ||
         node.name.toLowerCase().includes('.tab');
}

// Helper function to check if a node is the active tab
function isActiveTab(node: SceneNode): boolean {
  // Check if the node has a bottom border that's visible and colored
  if ('strokes' in node && node.strokes && node.strokes.length > 0) {
    const stroke = node.strokes[0] as SolidPaint;
    if (stroke.type === 'SOLID' && stroke.visible !== false) {
      // Check if it has a thicker bottom border
      if ('strokeBottomWeight' in node && node.strokeBottomWeight > 2) {
        return true;
      }
    }
  }
  return false;
}

// Helper function to check if a fill is effectively visible (has both visibility and non-zero opacity)
function isEffectivelyVisible(fill: Paint): boolean {
  if (!fill.visible) return false;

  // Check for opacity in the fill itself
  if ('opacity' in fill && (fill.opacity === 0 || fill.opacity === undefined)) {
    return false;
  }

  // For solid fills, also check if the color has 0 alpha
  if (fill.type === 'SOLID' && 'color' in fill) {
    if ('a' in fill.color && (fill.color.a === 0 || fill.color.a === undefined)) {
      return false;
    }
  }

  return true;
}

// Helper function to check if a node has any visible fills
function hasVisibleFills(fills: Paint[]): boolean {
  return fills && fills.length > 0 && fills.some(fill => isEffectivelyVisible(fill));
}

// Helper function to check if a fill is white
function isWhiteFill(fill: Paint): boolean {
  if (fill.type === 'SOLID') {
    const { r, g, b } = fill.color;
    // Check if the color is white (allowing for small floating point differences)
    return Math.abs(r - 1) < 0.01 && Math.abs(g - 1) < 0.01 && Math.abs(b - 1) < 0.01;
  }
  return false;
}

// Helper function to check if node has any visible non-white fills
function hasNonWhiteFills(node: SceneNode): boolean {
  if ('fills' in node && node.fills) {
    const fills = node.fills as Paint[];
    // Check if there are any visible fills that aren't white
    return fills.some(fill => isEffectivelyVisible(fill) && !isWhiteFill(fill));
  }
  return false;
}

// Calculate luminance of a color (perceived brightness)
function getLuminance(color: RGB): number {
  // Using the formula for relative luminance in sRGB colorspace
  // See: https://www.w3.org/TR/WCAG20/#relativeluminancedef
  return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}

// Get theme-specific luminance threshold
function getLuminanceThreshold(themeOption: ThemeOption): number {
  // Theme-specific thresholds
  const thresholds = {
    'mono': 0.5,        // Standard midpoint works well for grayscale
    'blueprint': 0.35,  // Blues need lower threshold as they're perceived as darker
    'dark-mode': 0.45   // Adjusted for dark mode's specific color palette
  };
  return thresholds[themeOption];
}

// Determine if a fill is dark based on theme-specific thresholds
function isDarkFill(fill: Paint, themeOption: ThemeOption): boolean {
  if (fill.type === 'SOLID') {
    const luminance = getLuminance(fill.color);
    return luminance < getLuminanceThreshold(themeOption);
  }
  return false;
}

// Helper function to get the most visible fill from a list of fills
function getMostVisibleFill(fills: Paint[]): Paint | null {
  if (!fills || fills.length === 0) return null;

  // Filter to only visible fills
  const visibleFills = fills.filter(fill => isEffectivelyVisible(fill));
  if (visibleFills.length === 0) return null;

  // If there's just one, return it
  if (visibleFills.length === 1) return visibleFills[0];

  // Prioritize solid fills
  const solidFills = visibleFills.filter(fill => fill.type === 'SOLID');
  if (solidFills.length > 0) {
    // Return the last one as it's typically the most visible/topmost
    return solidFills[solidFills.length - 1];
  }

  // If no solid fills, return the last visible one
  return visibleFills[visibleFills.length - 1];
}

// Enhanced function to check if node has dark fill - now theme-aware
function hasDarkFill(node: SceneNode, wireframeStyles: WireframeStylesType): boolean {
  if ('fills' in node && node.fills) {
    const mainFill = getMostVisibleFill(node.fills as Paint[]);
    const themeOption = getThemeFromStyles(wireframeStyles);
    return mainFill ? isDarkFill(mainFill, themeOption) : false;
  }

  // Special case for blueprint theme and certain parent types
  if (isTheme(wireframeStyles, 'blueprint') &&
      node.parent &&
      isShapeWithFill(node.parent) &&
      hasFillColor(node.parent, wireframeStyles.colors.fill)) {
    return true;  // Blueprint fill color should always be treated as dark
  }

  return false;
}

// Helper to get theme option from wireframe styles
function getThemeFromStyles(wireframeStyles: WireframeStylesType): ThemeOption {
  // Compare colors to determine which theme this is
  const colors = wireframeStyles.colors;

  // Check for blueprint theme's distinctive colors
  if (Math.abs(colors.fill.r - 0.29) < 0.01 &&
      Math.abs(colors.fill.g - 0.43) < 0.01 &&
      Math.abs(colors.fill.b - 0.9) < 0.01) {
    return 'blueprint';
  }

  // Check for dark mode's distinctive colors
  if (Math.abs(colors.background.r - 0.1) < 0.01 &&
      Math.abs(colors.background.g - 0.1) < 0.01 &&
      Math.abs(colors.background.b - 0.1) < 0.01) {
    return 'dark-mode';
  }

  // Default to mono
  return 'mono';
}

// Helper to check if a specific theme is being used
function isTheme(wireframeStyles: WireframeStylesType, themeOption: ThemeOption): boolean {
  return getThemeFromStyles(wireframeStyles) === themeOption;
}

// Helper to check if a node is a shape with fills
function isShapeWithFill(node: BaseNode): boolean {
  return 'fills' in node && Array.isArray((node as any).fills) && (node as any).fills.length > 0;
}

// Helper to check if a node has a specific fill color
function hasFillColor(node: BaseNode, color: RGB): boolean {
  if (!('fills' in node)) return false;

  const fills = (node as any).fills as Paint[] | undefined;
  if (!fills) return false;

  return fills.some(fill => {
    if (fill.type !== 'SOLID') return false;
    return Math.abs(fill.color.r - color.r) < 0.01 &&
           Math.abs(fill.color.g - color.g) < 0.01 &&
           Math.abs(fill.color.b - color.b) < 0.01;
  });
}

// Enhanced contrast detection for elements relative to their parent or context
function getContrastColor(node: SceneNode, wireframeStyles: WireframeStylesType): RGB {
  const themeType = getThemeFromStyles(wireframeStyles);

  // Special handling for text nodes
  if (isTextNode(node)) {
    // For Dark mode, we need to check specific parent fill colors
    if (themeType === 'dark-mode' && node.parent && isShapeWithFill(node.parent)) {
      // If parent has the fillInverted color (light backgrounds in dark mode)
      // or background color in dark mode, use dark text
      if (hasFillColor(node.parent, wireframeStyles.colors.fillInverted) ||
          hasFillColor(node.parent, wireframeStyles.colors.background)) {
        return wireframeStyles.colors.contentLight; // Actually dark text in dark mode
      }
    }

    // Check direct parent fill
    if (node.parent && isShapeWithFill(node.parent)) {
      const parentNode = node.parent as SceneNode;
      const parentIsDark = hasDarkFill(parentNode, wireframeStyles);
      if (parentIsDark) {
        return wireframeStyles.colors.contentLight;
      } else if (themeType === 'dark-mode') {
        // For dark mode, use darker text on any non-dark background
        return wireframeStyles.colors.contentLight;
      }
    }
  }

  // Special handling for boxes inside containers (bottom left square issue)
  if (node.type === 'RECTANGLE' || node.type === 'FRAME') {
    // Handle bottom left square special case - check if it's in a dark container
    if (node.parent &&
        (node.parent.type === 'FRAME' || node.parent.type === 'RECTANGLE') &&
        isShapeWithFill(node.parent)) {

      const parentNode = node.parent as SceneNode;

      // Check if parent has the specific fill color that should contrast with the child
      if ((themeType === 'blueprint' && hasFillColor(parentNode, wireframeStyles.colors.fillInverted)) ||
          (themeType === 'dark-mode' && hasFillColor(parentNode, wireframeStyles.colors.fill))) {
        // This is the bottom left square case - use inverted colors
        return wireframeStyles.colors.contentLight;
      }
    }
  }

  // Blueprint theme - treat filled containers as requiring light content
  if (themeType === 'blueprint' &&
      node.parent &&
      hasFillColor(node.parent, wireframeStyles.colors.fill)) {
    return wireframeStyles.colors.contentLight;
  }

  // Default to regular content color
  return wireframeStyles.colors.content;
}

// Special case for handling the bottom left square issue
function handleSpecialContainerCase(node: SceneNode, wireframeStyles: WireframeStylesType): boolean {
  const themeType = getThemeFromStyles(wireframeStyles);

  // Check if this is one of our special container cases
  if ((node.type === 'RECTANGLE' || node.type === 'FRAME') &&
      node.parent &&
      (node.parent.type === 'FRAME' || node.parent.type === 'RECTANGLE')) {

    const parentNode = node.parent as SceneNode;

    // Special case for the bottom left square issue
    if ((themeType === 'blueprint' && hasFillColor(parentNode, wireframeStyles.colors.fillInverted)) ||
        (themeType === 'dark-mode' && hasFillColor(parentNode, wireframeStyles.colors.fill))) {
      return true;
    }
  }

  return false;
}

// Apply border radius based on settings
function applyCornerRadius(node: SceneNode, wireframeStyles: WireframeStylesType) {
  // Only apply to elements that can have corner radius
  if (node.type !== 'ELLIPSE' && 'cornerRadius' in node) {
    if (wireframeStyles.applyRadius) {
      // Apply the radius from wireframe styles based on node type
      if (node.type === 'RECTANGLE') {
        node.topLeftRadius = wireframeStyles.radius;
        node.topRightRadius = wireframeStyles.radius;
        node.bottomLeftRadius = wireframeStyles.radius;
        node.bottomRightRadius = wireframeStyles.radius;
      } else if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') {
        node.topLeftRadius = wireframeStyles.radius;
        node.topRightRadius = wireframeStyles.radius;
        node.bottomLeftRadius = wireframeStyles.radius;
        node.bottomRightRadius = wireframeStyles.radius;
      }
    } else {
      // If rounded corners are disabled, set to 0 for a sharp look
      if (node.type === 'RECTANGLE') {
        node.topLeftRadius = 0;
        node.topRightRadius = 0;
        node.bottomLeftRadius = 0;
        node.bottomRightRadius = 0;
      } else if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') {
        node.topLeftRadius = 0;
        node.topRightRadius = 0;
        node.bottomLeftRadius = 0;
        node.bottomRightRadius = 0;
      }
    }
  }
}

// Core conversion functions
async function convertToWireframe(
  node: SceneNode,
  progress: { current: number, total: number },
  wireframeStyles: WireframeStylesType
) {
  try {
    // Update progress
    progress.current++;
    figma.ui.postMessage({
      type: 'progress',
      value: progress.current,
      total: progress.total
    });

    // Process based on node type
    if (isTextNode(node)) {
      await convertText(node, wireframeStyles);
    }
    else if (isShapeNode(node)) {
      convertShape(node, wireframeStyles);
    }
    else if (isVectorNode(node)) {
      convertVector(node, wireframeStyles);
    }
    else if (hasChildren(node)) {
      await convertContainer(node, progress, wireframeStyles);
    }

  } catch (error) {
    console.error(`Error converting node ${node.name}:`, error);
  }
}

async function convertText(node: TextNode, wireframeStyles: WireframeStylesType) {
  // Save original properties we want to preserve
  const originalSize = node.fontSize;
  const originalWidth = node.width;
  const originalX = node.x;
  const originalY = node.y;
  const originalTextAutoResize = node.textAutoResize;
  const originalHeight = node.height;

  // Get appropriate text color based on context
  const textColor = getContrastColor(node, wireframeStyles);

  // Load and apply font
  await figma.loadFontAsync(wireframeStyles.text.font);
  node.fontName = wireframeStyles.text.font;

  // Apply wireframe styles while preserving key properties
  node.fills = [{
    type: 'SOLID',
    color: textColor
  }];

  // Restore original properties
  if (originalSize) {
    node.fontSize = originalSize;
  }
  node.x = originalX;
  node.y = originalY;

  // Restore original text auto-resize behavior
  node.textAutoResize = originalTextAutoResize;

  // Restore dimensions based on auto-resize behavior
  if (originalTextAutoResize === "TRUNCATE") {
    node.resize(originalWidth, originalHeight);
  } else if (originalTextAutoResize === "HEIGHT") {
    node.resize(originalWidth, node.height);
  } else if (originalTextAutoResize === "NONE") {
    node.resize(originalWidth, originalHeight);
  } else if (originalTextAutoResize === "WIDTH_AND_HEIGHT") {
    // Let it auto-resize both dimensions
    node.resize(node.width, node.height);
  }
}

function convertShape(node: RectangleNode | EllipseNode | PolygonNode, wireframeStyles: WireframeStylesType) {
  // Preserve original position and dimensions
  const originalX = node.x;
  const originalY = node.y;
  const originalWidth = node.width;
  const originalHeight = node.height;

  // Determine if this is a dark element
  const isDark = hasDarkFill(node, wireframeStyles);

  // Check for special container case
  const isSpecialCase = handleSpecialContainerCase(node, wireframeStyles);

  // Apply wireframe styles
  if ('fills' in node) {
    const fills = node.fills as Paint[];

    // If all fills are hidden or there are no fills, keep it transparent
    if (!hasVisibleFills(fills)) {
      node.fills = [];
    }
    // Special case for bottom left square
    else if (isSpecialCase) {
      // Use light fill for better contrast with dark parent
      node.fills = [{ type: 'SOLID', color: wireframeStyles.colors.contentLight }];
    }
    // If it has visible fills but they're all white, keep it white
    else if (!hasNonWhiteFills(node)) {
      node.fills = [{ type: 'SOLID', color: wireframeStyles.colors.background }];
    }
    // If it has dark fills originally, keep it dark in wireframe
    else if (isDark) {
      node.fills = [{ type: 'SOLID', color: wireframeStyles.colors.fillInverted }];
    }
    // Otherwise, use the standard light fill for wireframe
    else {
      node.fills = [{ type: 'SOLID', color: wireframeStyles.colors.fill }];
    }
  }

  if ('strokes' in node) {
    // Preserve the original stroke alignment and weights
    const hasStrokes = node.strokes && node.strokes.length > 0;
    const strokeAlign = node.strokeAlign;
    const strokeWeight = node.strokeWeight;

    // Only apply strokes if they existed in the original
    if (hasStrokes) {
      node.strokes = [{ type: 'SOLID', color: wireframeStyles.colors.stroke }];
      node.strokeAlign = strokeAlign;
      node.strokeWeight = strokeWeight;
    } else {
      node.strokes = [];
    }
  }

  // Apply corner radius based on settings
  applyCornerRadius(node, wireframeStyles);

  // Restore position and dimensions
  node.x = originalX;
  node.y = originalY;
  node.resize(originalWidth, originalHeight);
}

function convertVector(node: VectorNode, wireframeStyles: WireframeStylesType) {
  if ('fills' in node) {
    const fills = node.fills as Paint[];

    // Determine if this is a dark element
    const isDark = hasDarkFill(node, wireframeStyles);

    // If all fills are hidden or there are no fills, keep it transparent
    if (!hasVisibleFills(fills)) {
      node.fills = [];
    }
    // If it's part of a button or icon, use appropriate content color based on context
    else if (node.parent && (
      node.parent.name.toLowerCase().includes('button') ||
      node.parent.name.toLowerCase().includes('icon') ||
      node.name.toLowerCase().includes('icon')
    )) {
      // Get appropriate color based on context
      const vectorColor = getContrastColor(node, wireframeStyles);
      node.fills = [{
        type: 'SOLID',
        color: vectorColor
      }];
    }
    // For other vectors, preserve white fills
    else if (!hasNonWhiteFills(node)) {
      node.fills = [{ type: 'SOLID', color: wireframeStyles.colors.background }];
    }
    // For vectors with dark fills, keep them dark
    else if (isDark) {
      node.fills = [{ type: 'SOLID', color: wireframeStyles.colors.fillInverted }];
    }
    // For all other cases, use content color
    else {
      node.fills = [{ type: 'SOLID', color: wireframeStyles.colors.content }];
    }
  }

  // Remove strokes from vectors to keep them clean
  if ('strokes' in node) {
    node.strokes = [];
  }
}

async function convertContainer(
  node: FrameNode | ComponentNode | InstanceNode,
  progress: { current: number, total: number },
  wireframeStyles: WireframeStylesType
) {
  // Get theme information
  const themeOption = getThemeFromStyles(wireframeStyles);

  // Determine if this is a dark container
  let isDark = false;
  if ('backgrounds' in node) {
    const mainFill = getMostVisibleFill(node.backgrounds as Paint[]);
    isDark = mainFill ? isDarkFill(mainFill, themeOption) : false;
  }

  // Handle container-specific properties
  if ('backgrounds' in node) {
    const backgrounds = node.backgrounds as Paint[];

    // If all backgrounds are hidden or there are no backgrounds, keep it transparent
    if (!hasVisibleFills(backgrounds)) {
      node.backgrounds = [];
    }
    // If it's an icon container or logo container, keep it transparent
    else if (isIconContainer(node) || node.name.toLowerCase().includes('logo')) {
      node.backgrounds = [];
    }
    // If it has visible backgrounds but they're all white, keep it white
    else if (!hasNonWhiteFills(node)) {
      node.backgrounds = [{ type: 'SOLID', color: wireframeStyles.colors.background }];
    }
    // If it has dark backgrounds originally, keep it dark in wireframe
    else if (isDark) {
      node.backgrounds = [{ type: 'SOLID', color: wireframeStyles.colors.fillInverted }];
    }
    // If it has any visible non-white backgrounds, convert to wireframe fill
    else {
      node.backgrounds = [{ type: 'SOLID', color: wireframeStyles.colors.fill }];
    }
  }

  // Handle strokes
  if ('strokes' in node) {
    // Preserve the original stroke alignment and weights
    const hasStrokes = node.strokes && node.strokes.length > 0;
    const strokeAlign = node.strokeAlign;
    const strokeTop = node.strokeTopWeight || 0;
    const strokeRight = node.strokeRightWeight || 0;
    const strokeBottom = node.strokeBottomWeight || 0;
    const strokeLeft = node.strokeLeftWeight || 0;

    // Only apply strokes if they existed in the original
    if (hasStrokes) {
      node.strokes = [{ type: 'SOLID', color: wireframeStyles.colors.stroke }];
      node.strokeAlign = strokeAlign;
      node.strokeTopWeight = strokeTop;
      node.strokeRightWeight = strokeRight;
      node.strokeBottomWeight = strokeBottom;
      node.strokeLeftWeight = strokeLeft;
    } else {
      node.strokes = [];
    }
  }

  // Apply corner radius to frames and components if needed
  applyCornerRadius(node, wireframeStyles);

  // Process all children
  for (const child of node.children) {
    await convertToWireframe(child, progress, wireframeStyles);
  }
}

// Count total nodes for progress tracking
function countNodes(node: SceneNode): number {
  let count = 1;
  if (hasChildren(node)) {
    for (const child of node.children) {
      count += countNodes(child);
    }
  }
  return count;
}

// Show help documentation
function showHelp() {
  figma.notify("🎨 Wireframe Converter Help", { timeout: 10000 });
  // Show additional help in a separate notification
  setTimeout(() => {
    figma.notify("Click 'Learn More' for documentation", {
      timeout: 5000,
      button: {
        text: "Learn More",
        action: () => {
          figma.notify("Visit our documentation for detailed instructions and examples.");
        }
      }
    });
  }, 500);
}

// Main message handler
figma.ui.onmessage = async (msg: Message) => {
  if (msg.type === 'help') {
    showHelp();
    return;
  }

  if (msg.type === 'close') {
    figma.closePlugin();
    return;
  }

  if (msg.type === 'convert') {
    const selection = figma.currentPage.selection;

    if (selection.length === 0) {
      figma.notify('Please select at least one node to convert.');
      figma.ui.postMessage({ type: 'complete' });
      return;
    }

    // Get selected font from UI or use default
    const fontOption = msg.fontChoice || 'handwritten' as FontOption;
    const fontChoice = fontMapping[fontOption];

    // Get selected theme from UI or use default
    const themeOption = msg.themeChoice || 'mono' as ThemeOption;

    // Get rounded corners setting (default to true if not specified)
    const useRoundedCorners = msg.useRoundedCorners !== undefined ? msg.useRoundedCorners : true;

    // Create wireframe styles based on theme and font choices
    const wireframeStyles = getWireframeStyles(themeOption, fontChoice, useRoundedCorners);

    // Load the selected font
    await figma.loadFontAsync(fontChoice);

    // Clone the selection and convert to wireframe
    let totalNodes = 0;
    let processedNodes = 0;

    // Count total nodes first
    selection.forEach(node => {
      totalNodes += countDescendants(node);
    });

    figma.ui.postMessage({
      type: 'progress',
      value: processedNodes,
      total: totalNodes
    });

    // Process each node
    for (const node of selection) {
      if ('clone' in node) {
        const clone = node.clone();
        // Position the wireframe to the right of the original
        clone.x = node.x + node.width + 100;

        // Begin the wireframe conversion process
        await processNode(clone, processedNodes, totalNodes, wireframeStyles);

        figma.currentPage.selection = [clone];
        figma.viewport.scrollAndZoomIntoView([clone]);
      } else {
        figma.notify('Selected node cannot be cloned');
      }
    }

    figma.notify('Wireframe conversion complete! ✅');
    figma.ui.postMessage({ type: 'complete' });
  }
};

// Helper to count total nodes for progress tracking
function countDescendants(node: BaseNode): number {
  let count = 1; // Count the node itself

  if ('children' in node) {
    const parent = node as ChildrenMixin;
    for (const child of parent.children) {
      count += countDescendants(child);
    }
  }

  return count;
}

// Process node and update progress
async function processNode(
  node: SceneNode,
  processed: number,
  total: number,
  wireframeStyles: WireframeStylesType
) {
  processed++;

  // Update progress every 10 nodes to reduce UI updates
  if (processed % 10 === 0 || processed === total) {
    figma.ui.postMessage({
      type: 'progress',
      value: processed,
      total: total
    });
  }

  // Start the conversion process
  const progress = { current: processed, total: total };
  await convertToWireframe(node, progress, wireframeStyles);

  // Process children if any
  if ('children' in node) {
    for (const child of (node as ChildrenMixin).children) {
      if ('id' in child) { // Ensure it's a SceneNode
        await processNode(child as SceneNode, processed, total, wireframeStyles);
      }
    }
  }

  return processed;
}