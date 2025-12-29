export interface FaceLocation {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GestureDetected {
  hand: 'Left' | 'Right';
  gesture: string;
}

export interface VerifyFaceResponseInterface {
  employee_id: string;
  confidence: 'low' | 'medium' | 'high';
  face_location: FaceLocation;
  gestures_detected: GestureDetected[];
}
