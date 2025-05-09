interface Message {
  type: 'convert-to-wireframe' | 'help' | 'convert' | 'close';
  fontChoice?: 'handwritten' | 'sans-serif' | 'serif';
}

figma.showUI(__html__, {
  themeColors: true,
  width: 240,
  height: 370,
});

// Core wireframe styles
const WireframeStyles = {
  colors: {
    content: { r: 0.2, g: 0.2, b: 0.2 },     // Dark gray for text and icons
    contentLight: { r: 0.95, g: 0.95, b: 0.95 }, // Light gray for text on dark backgrounds
    fill: { r: 0.9, g: 0.9, b: 0.9 },        // Light gray for fills
    fillInverted: { r: 0.25, g: 0.25, b: 0.25 }, // Dark gray for dark backgrounds
    stroke: { r: 0.6, g: 0.6, b: 0.6 },      // Medium gray for borders
    background: { r: 1, g: 1, b: 1 }         // White for backgrounds
  },
  strokes: {
    default: 1,
    border: 0.5
  },
  text: {
    font: { family: "Figma Hand", style: "Regular" }
  },
  radius: 4  // Default border radius for non-ellipse elements
};

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

// Determine if a fill is dark (by calculating its luminance)
function isDarkFill(fill: Paint): boolean {
  if (fill.type === 'SOLID') {
    const luminance = getLuminance(fill.color);
    return luminance < 0.5; // 0.5 is the midpoint between black (0) and white (1)
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

// Helper function to check if node has dark fill
function hasDarkFill(node: SceneNode): boolean {
  if ('fills' in node && node.fills) {
    const mainFill = getMostVisibleFill(node.fills as Paint[]);
    return mainFill ? isDarkFill(mainFill) : false;
  }
  return false;
}

// Core conversion functions
async function convertToWireframe(node: SceneNode, progress: { current: number, total: number }, fontChoice: FontName) {
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
      await convertText(node, fontChoice);
    }
    else if (isShapeNode(node)) {
      convertShape(node);
    }
    else if (isVectorNode(node)) {
      convertVector(node);
    }
    else if (hasChildren(node)) {
      await convertContainer(node, progress, fontChoice);
    }

  } catch (error) {
    console.error(`Error converting node ${node.name}:`, error);
  }
}

async function convertText(node: TextNode, fontChoice: FontName) {
  // Save original properties we want to preserve
  const originalSize = node.fontSize;
  const originalWidth = node.width;
  const originalX = node.x;
  const originalY = node.y;
  const originalTextAutoResize = node.textAutoResize;
  const originalHeight = node.height;

  // Check if the parent has a dark fill - this would indicate light text on dark background
  const parentIsDark = node.parent && 'fills' in node.parent && hasDarkFill(node.parent);

  // Load and apply font
  await figma.loadFontAsync(fontChoice);
  node.fontName = fontChoice;

  // Apply wireframe styles while preserving key properties
  // Use light text color if parent is dark, otherwise use dark text color
  node.fills = [{
    type: 'SOLID',
    color: parentIsDark ? WireframeStyles.colors.contentLight : WireframeStyles.colors.content
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

function convertShape(node: RectangleNode | EllipseNode | PolygonNode) {
  // Preserve original position and dimensions
  const originalX = node.x;
  const originalY = node.y;
  const originalWidth = node.width;
  const originalHeight = node.height;

  // Determine if this is a dark element
  const isDark = hasDarkFill(node);

  // Apply wireframe styles
  if ('fills' in node) {
    const fills = node.fills as Paint[];

    // If all fills are hidden or there are no fills, keep it transparent
    if (!hasVisibleFills(fills)) {
      node.fills = [];
    }
    // If it has visible fills but they're all white, keep it white
    else if (!hasNonWhiteFills(node)) {
      node.fills = [{ type: 'SOLID', color: WireframeStyles.colors.background }];
    }
    // If it has dark fills originally, keep it dark in wireframe
    else if (isDark) {
      node.fills = [{ type: 'SOLID', color: WireframeStyles.colors.fillInverted }];
    }
    // Otherwise, use the standard light fill for wireframe
    else {
      node.fills = [{ type: 'SOLID', color: WireframeStyles.colors.fill }];
    }
  }

  if ('strokes' in node) {
    // Preserve the original stroke alignment and weights
    const hasStrokes = node.strokes && node.strokes.length > 0;
    const strokeAlign = node.strokeAlign;
    const strokeWeight = node.strokeWeight;

    // Only apply strokes if they existed in the original
    if (hasStrokes) {
      node.strokes = [{ type: 'SOLID', color: WireframeStyles.colors.stroke }];
      node.strokeAlign = strokeAlign;
      node.strokeWeight = strokeWeight;
    } else {
      node.strokes = [];
    }
  }

  // Apply border radius to non-ellipse elements
  if (node.type !== 'ELLIPSE' && 'cornerRadius' in node) {
    node.cornerRadius = WireframeStyles.radius;
  }

  // Restore position and dimensions
  node.x = originalX;
  node.y = originalY;
  node.resize(originalWidth, originalHeight);
}

function convertVector(node: VectorNode) {
  if ('fills' in node) {
    const fills = node.fills as Paint[];
    // Determine if this is a dark element
    const isDark = hasDarkFill(node);

    // Determine if the parent has a dark fill
    const parentIsDark = node.parent && 'fills' in node.parent && hasDarkFill(node.parent);

    // If all fills are hidden or there are no fills, keep it transparent
    if (!hasVisibleFills(fills)) {
      node.fills = [];
    }
    // If it's part of a button or icon, use appropriate content color
    else if (node.parent && (
      node.parent.name.toLowerCase().includes('button') ||
      node.parent.name.toLowerCase().includes('icon') ||
      node.name.toLowerCase().includes('icon')
    )) {
      // Use light content color if parent is dark
      node.fills = [{
        type: 'SOLID',
        color: parentIsDark ? WireframeStyles.colors.contentLight : WireframeStyles.colors.content
      }];
    }
    // For other vectors, preserve white fills
    else if (!hasNonWhiteFills(node)) {
      node.fills = [{ type: 'SOLID', color: WireframeStyles.colors.background }];
    }
    // For vectors with dark fills, keep them dark
    else if (isDark) {
      node.fills = [{ type: 'SOLID', color: WireframeStyles.colors.fillInverted }];
    }
    // For all other cases, use content color
    else {
      node.fills = [{ type: 'SOLID', color: WireframeStyles.colors.content }];
    }
  }

  // Remove strokes from vectors to keep them clean
  if ('strokes' in node) {
    node.strokes = [];
  }
}

async function convertContainer(node: FrameNode | ComponentNode | InstanceNode, progress: { current: number, total: number }, fontChoice: FontName) {
  // Determine if this is a dark container
  const isDark = 'backgrounds' in node ?
    (getMostVisibleFill(node.backgrounds as Paint[]) ?
      isDarkFill(getMostVisibleFill(node.backgrounds as Paint[])!) : false) :
    false;

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
      node.backgrounds = [{ type: 'SOLID', color: WireframeStyles.colors.background }];
    }
    // If it has dark backgrounds originally, keep it dark in wireframe
    else if (isDark) {
      node.backgrounds = [{ type: 'SOLID', color: WireframeStyles.colors.fillInverted }];
    }
    // If it has any visible non-white backgrounds, convert to wireframe fill
    else {
      node.backgrounds = [{ type: 'SOLID', color: WireframeStyles.colors.fill }];
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
      node.strokes = [{ type: 'SOLID', color: WireframeStyles.colors.stroke }];
      node.strokeAlign = strokeAlign;
      node.strokeTopWeight = strokeTop;
      node.strokeRightWeight = strokeRight;
      node.strokeBottomWeight = strokeBottom;
      node.strokeLeftWeight = strokeLeft;
    } else {
      node.strokes = [];
    }
  }

  // Process all children
  for (const child of node.children) {
    await convertToWireframe(child, progress, fontChoice);
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
        await processNode(clone, processedNodes, totalNodes, fontChoice);

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
async function processNode(node: SceneNode, processed: number, total: number, fontChoice: FontName) {
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
  await convertToWireframe(node, progress, fontChoice);

  // Process children if any
  if ('children' in node) {
    for (const child of (node as ChildrenMixin).children) {
      if ('id' in child) { // Ensure it's a SceneNode
        await processNode(child as SceneNode, processed, total, fontChoice);
      }
    }
  }

  return processed;
}