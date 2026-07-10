export type CertificateType = 'Pump' | 'Meter';

export interface CalibrationRun {
  id: string;
  masterVol: string;
  mutVol: string;
  comment: string;
  diff: number | null;
  factor: number | null;
  errorPct: number | null;
}

export interface CertificateData {
  certType: CertificateType;
  certNo: string;
  certDate: string;
  nextCalDate: string;
  nextCalInterval: string;
  
  meterOwner: string;
  location: string;
  unitTypeVal: string;
  
  putModel: string;
  putSerial: string;
  putFlow: string;
  putAccuracy: string;
  putProduct: string;
  putTotFinish: string;
  putTotStart: string;
  putProductDrawn: string;
  
  smModel: string;
  smSerial: string;
  smFlow: string;
  smAccuracy: string;
  smTotFinish: string;
  smTotStart: string;
  smProductDrawn: string;
  
  method: string;
  runs: CalibrationRun[];
  
  avgError: string;
  beforeError: string;
  avgFactor: string;
  adjustment: 'none' | 'made';
  verdict: 'pass' | 'fail' | 'neutral';
  verdictText: string;
  
  techName: string;
  techInitials?: string;
  authName: string;
  customerName: string;
  remarks: string;

  // Images (Base64)
  officialStamp?: string;
  verificationStamp?: string;
  authSignature?: string;
}
