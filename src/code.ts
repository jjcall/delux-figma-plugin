interface Message {
  type: 'convert-to-wireframe' | 'help';
}

figma.showUI(__html__, {
  width: 320,
  height: 360,
  themeColors: true
});

// Core wireframe styles
const WireframeStyles = {
  colors: {
    content: { r: 0.2, g: 0.2, b: 0.2 },     // Dark gray for text and icons
    fill: { r: 0.9, g: 0.9, b: 0.9 },        // Light gray for fills
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

// Core conversion functions
async function convertToWireframe(node: SceneNode, progress: { current: number, total: number }) {
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
      await convertText(node);
    }
    else if (isShapeNode(node)) {
      convertShape(node);
    }
    else if (isVectorNode(node)) {
      convertVector(node);
    }
    else if (hasChildren(node)) {
      await convertContainer(node, progress);
    }

  } catch (error) {
    console.error(`Error converting node ${node.name}:`, error);
  }
}

async function convertText(node: TextNode) {
  // Save original properties we want to preserve
  const originalSize = node.fontSize;
  const originalWidth = node.width;
  const originalX = node.x;
  const originalY = node.y;
  const originalTextAutoResize = node.textAutoResize;
  const originalHeight = node.height;

  // Load and apply font
  await figma.loadFontAsync(WireframeStyles.text.font);
  node.fontName = WireframeStyles.text.font;

  // Apply wireframe styles while preserving key properties
  node.fills = [{ type: 'SOLID', color: WireframeStyles.colors.content }];

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
    // If it has any visible non-white fills, convert to wireframe fill
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

    // If all fills are hidden or there are no fills, keep it transparent
    if (!hasVisibleFills(fills)) {
      node.fills = [];
    }
    // If it's part of a button or icon, use content color regardless of original fill
    else if (node.parent && (
      node.parent.name.toLowerCase().includes('button') ||
      node.parent.name.toLowerCase().includes('icon') ||
      node.name.toLowerCase().includes('icon')
    )) {
      node.fills = [{ type: 'SOLID', color: WireframeStyles.colors.content }];
    }
    // For other vectors, preserve white fills
    else if (!hasNonWhiteFills(node)) {
      node.fills = [{ type: 'SOLID', color: WireframeStyles.colors.background }];
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

async function convertContainer(node: FrameNode | ComponentNode | InstanceNode, progress: { current: number, total: number }) {
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
    await convertToWireframe(child, progress);
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

  if (msg.type === 'convert-to-wireframe') {
    const selection = figma.currentPage.selection;

    if (selection.length === 0) {
      figma.notify('Please select a frame to convert');
      return;
    }

    const node = selection[0];
    if (!hasChildren(node)) {
      figma.notify('Please select a frame or component');
      return;
    }

    // Load the Figma Hand font
    await figma.loadFontAsync({ family: "Figma Hand", style: "Regular" });

    // Clone the selected node
    const clone = node.clone();
    if (!node.parent) {
      figma.notify('Error: Node has no parent');
      return;
    }
    node.parent.appendChild(clone);
    clone.x = node.x + node.width + 100;

    // Convert the clone to wireframe
    const progress = { current: 0, total: countNodes(clone) };
    await convertToWireframe(clone, progress);

    // Notify completion
    figma.ui.postMessage({ type: 'conversion-complete' });
    figma.notify('Wireframe conversion complete! 🎉');
  }
};