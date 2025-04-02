# Task 2: Basic Frame Selection and Duplication

## Description
Implement the core capability to select a frame/artboard in Figma and create a duplicate of it, which will later be transformed into a wireframe.

## Deliverables
- Create UI button to trigger the wireframe conversion
- Add functionality to detect current selection in Figma
- Implement validation to ensure selection is a frame or artboard
- Add ability to duplicate the selected frame/artboard
- Append "_Wireframe" to the name of the duplicated frame
- Position the wireframe copy adjacent to the original

## Acceptance Criteria
- User can select a frame and click a button to create a duplicate
- Plugin validates that selection is appropriate (frame/artboard)
- Duplicated frame maintains the original structure and position
- Duplicated frame is properly named with "_Wireframe" suffix
- Error messages display when selection is invalid

## Estimated Effort
1-2 days

## Dependencies
- Task 1: Setup Plugin Structure