declare module "wmf" {
  export function image_size(data: ArrayBuffer | Uint8Array): [number, number];
  export function draw_canvas(data: ArrayBuffer | Uint8Array, canvas: HTMLCanvasElement): void;

  const api: {
    image_size: typeof image_size;
    draw_canvas: typeof draw_canvas;
  };
  export default api;
}
