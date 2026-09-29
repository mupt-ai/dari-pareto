import { describe, expect, test } from "bun:test";

import { placeLabels } from "../src/labels";

const bounds = { x: 0, y: 0, width: 400, height: 200 };

describe("placeLabels", () => {
  test("prefers the spot above the point", () => {
    const [label] = placeLabels([{ id: "a", x: 100, y: 100, text: "Alpha" }], {
      markers: [],
      bounds,
      fontSize: 10,
    });
    expect(label).toMatchObject({ id: "a", anchor: "middle" });
    expect(label?.y).toBeLessThan(100);
  });

  test("moves a label off an earlier label and off other points", () => {
    const placed = placeLabels(
      [
        { id: "a", x: 100, y: 100, text: "Alpha" },
        { id: "b", x: 104, y: 100, text: "Beta" },
      ],
      { markers: [{ x: 100, y: 80, radius: 5 }], bounds, fontSize: 10 },
    );
    expect(placed.map((label) => label.id)).toEqual(["a", "b"]);
    // Above is blocked by the marker for "a" and by "a" itself for "b".
    expect(placed[0]?.anchor).not.toBe("middle");
    expect(placed[1]?.y).toBeGreaterThan(100);
  });

  test("leaves out a label with no room", () => {
    expect(
      placeLabels([{ id: "a", x: 5, y: 5, text: "A very long label" }], {
        markers: [],
        bounds: { x: 0, y: 0, width: 20, height: 10 },
        fontSize: 10,
      }),
    ).toEqual([]);
  });

  test("keeps off a line when it can, and crosses it only when nothing else fits", () => {
    const label = { id: "a", x: 100, y: 100, text: "Alpha" };
    // A line running up through the spot above the point pushes the label to the right.
    const upward = [[{ x: 100, y: 100 }, { x: 100, y: 0 }]];
    expect(placeLabels([label], { markers: [], lines: upward, bounds, fontSize: 10 })[0]?.anchor).toBe("start");
    // A line through every spot does not hide the label.
    const around = [[{ x: 0, y: 80 }, { x: 400, y: 80 }], [{ x: 0, y: 100 }, { x: 400, y: 100 }], [{ x: 0, y: 118 }, { x: 400, y: 118 }]];
    expect(placeLabels([label], { markers: [], lines: around, bounds, fontSize: 10 })).toHaveLength(1);
  });

  test("never sits nearer another point than its own", () => {
    // A neighbour just right of the point rules out the right-hand spots and the diagonals
    // towards it, however free they are.
    const [label] = placeLabels([{ id: "a", x: 100, y: 100, text: "Alpha" }], {
      markers: [
        { x: 100, y: 100, radius: 5 },
        { x: 136, y: 100, radius: 5 },
      ],
      lines: [[{ x: 100, y: 100 }, { x: 100, y: 0 }]],
      bounds,
      fontSize: 10,
    });
    expect(label?.anchor).toBe("end");
  });
});
