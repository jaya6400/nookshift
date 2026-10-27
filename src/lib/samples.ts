export type Sample = {
  id: string;
  src: string;
  label: string;
  hint: string;
};

export const SAMPLES: Sample[] = [
  {
    id: "room-1",
    src: "/samples/room-1.png",
    label: "Sunlit living room",
    hint: "Test sofa recolor & declutter",
  },
  {
    id: "room-2",
    src: "/samples/room-2.png",
    label: "Compact bedroom",
    hint: "Test storage & palette shift",
  },
  {
    id: "room-3",
    src: "/samples/room-3.png",
    label: "Work corner near window",
    hint: "Test desk reposition & plants",
  },
];
