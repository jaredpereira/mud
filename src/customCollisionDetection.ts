import {
  ClientRect,
  CollisionDetection,
  CollisionDescriptor,
} from "@dnd-kit/core";
/**
 * Returns the intersecting rectangle area between two rectangles
 */
export function getIntersectionRatio(
  entry: ClientRect,
  target: ClientRect
): [number, number] {
  const top = Math.max(target.top, entry.top);
  const left = Math.max(target.left, entry.left);
  const right = Math.min(target.left + target.width, entry.left + entry.width);
  const bottom = Math.min(target.top + target.height, entry.top + entry.height);
  const width = right - left;
  const height = bottom - top;

  if (left < right && top < bottom) {
    const targetArea = target.width * target.height;
    const entryArea = entry.width * entry.height;
    const intersectionArea = width * height;
    const intersectionRatio =
      intersectionArea / (targetArea + entryArea - intersectionArea);

    return [
      Number(intersectionRatio.toFixed(4)),
      Number((intersectionArea / targetArea).toFixed(4)),
    ];
  }

  // Rectangles do not overlap, or overlap has an area of zero (edge/corner overlap)
  return [0, 0];
}

/**
 * Returns the rectangles that has the greatest intersection area with a given
 * rectangle in an array of rectangles.
 */
export const customCollisionDetection: CollisionDetection = ({
  collisionRect,
  droppableRects,
  droppableContainers,
}) => {
  const collisions: CollisionDescriptor[] = [];

  for (const droppableContainer of droppableContainers) {
    const { id } = droppableContainer;
    const rect = droppableRects.get(id);

    if (rect) {
      const [intersectionRatio, targetRatio] = getIntersectionRatio(
        rect,
        collisionRect
      );

      if (intersectionRatio > 0) {
        collisions.push({
          id,
          data: { droppableContainer, value: intersectionRatio, targetRatio },
        });
      }
    }
  }

  return collisions.sort(sortCollisionsDesc);
};

function sortCollisionsDesc(
  { data: { value: a } }: CollisionDescriptor,
  { data: { value: b } }: CollisionDescriptor
) {
  return b - a;
}