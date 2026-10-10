# Contract request: Studio drag-and-drop dependencies

- **From:** sol
- **For task:** 2.6
- **Status:** open

## What I need
Add `@dnd-kit/core@^6.3.1` and `@dnd-kit/sortable@^10.0.0` to `apps/web/package.json`, and update the workspace lockfile. Versions were checked against the npm registry on October 10, 2026.

## Why
The Studio board needs pointer and keyboard drag sensors, sortable columns/cards, accessible announcements, and drop handling. Dependency files belong to Opus.

## Proposed shape
Use DndContext, PointerSensor, KeyboardSensor, SortableContext and useSortable in Sol-owned `features/studio`.

## Workaround until then
Build the board data layer and accessible explicit move/reorder controls against the existing API; enable drag once the dependencies land.
