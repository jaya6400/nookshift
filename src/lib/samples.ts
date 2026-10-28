export type Sample = {
  id: string;
  src: string;
  label: string;
  hint: string;
  title?: string;
  description?: string;
  images?: string[];
  primaryImage?: string;
  isRealRoom?: boolean;
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
  {
    id: "real-room-india-1bhk",
    title: "My Real Room - India 1BHK",
    description: "Real cluttered 1BHK in India — test real-world rearrangement",
    images: [
      "/samples/real-room/full-mandir-hall-room.jpg",
      "/samples/real-room/mandir-area.jpg",
      "/samples/real-room/two-seater.jpg",
    ],
    primaryImage: "/samples/real-room/full-mandir-hall-room.jpg",
    src: "/samples/real-room/full-mandir-hall-room.jpg",
    label: "My Real Room - India 1BHK",
    hint: "Real cluttered 1BHK in India — test real-world rearrangement",
    isRealRoom: true,
  },
];
