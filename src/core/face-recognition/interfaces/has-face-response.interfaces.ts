export interface HasFaceResponseInterface {
  has_face: boolean;
  count: number;
  boxes: FaceBox[];
}

export interface FaceBox {
  x: number;
  y: number;
  w: number;
  h: number;
}
