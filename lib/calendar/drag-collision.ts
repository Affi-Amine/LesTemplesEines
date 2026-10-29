import { pointerWithin, type CollisionDetection } from "@dnd-kit/core"

// Align the START of the booking, preserving the point where it was grabbed.
// A long press without movement must never turn 09:00 into 09:30.
export const appointmentCollisionDetection: CollisionDetection = args => pointerWithin({
  ...args,
  pointerCoordinates: args.pointerCoordinates ? {
    x: args.pointerCoordinates.x,
    y: args.collisionRect.top + 2,
  } : null,
})
