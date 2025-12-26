export interface VerifyFaceResponseInterface {
  employee_id: string;
  confidence: string;
  gestures_detected: [
    {
      hand: 'Left' | 'Right';
      gesture: string;
    },
  ];
}
