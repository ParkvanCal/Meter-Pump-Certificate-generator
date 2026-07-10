import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const COLORS = {
  NAVY: '#0B1F3A',
  NAVY_MID: '#122345',
  NAVY_LITE: '#1F3B72',
  GOLD: '#C9A84C',
  GOLD_LT: '#E8C97E',
  OFF_WHITE: '#F7F8FA',
  LT_GREY: '#E0E5ED',
  MID_GREY: '#B0BBCC',
  DARK_TEXT: '#1A2A3A',
  MED_TEXT: '#4A6080',
  SUCCESS: '#1A6B3A',
  DANGER: '#B03020',
};

export const LOGO_URL = "https://raw.githubusercontent.com/ParkvanCal/ParkvanCal/main/images/PVC%20Logo.png";
