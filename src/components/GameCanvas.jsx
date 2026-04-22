import { forwardRef } from 'react';

const GameCanvas = forwardRef(function GameCanvas({ isDragging, onMouseDown, onMouseMove, onMouseUp, onWheel, onTouchStart, onTouchMove, onTouchEnd }, ref) {
    return (
        <canvas
            ref={ref}
            style={{ position: "absolute", inset: 0, touchAction: "none", cursor: isDragging ? "crosshair" : "default" }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onWheel={onWheel}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        />
    );
});

export default GameCanvas;
