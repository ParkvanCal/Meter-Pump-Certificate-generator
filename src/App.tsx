import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Settings, 
  RefreshCcw, 
  Download, 
  Plus, 
  Trash2, 
  Edit2, 
  ChevronRight, 
  Clock, 
  History,
  Search,
  BookOpen,
  User, 
  MapPin, 
  CheckCircle2, 
  AlertCircle,
  FlaskConical,
  Gauge,
  Factory,
  Github
} from 'lucide-react';
import { format, addMonths, addYears, parseISO, isValid } from 'date-fns';
import { CertificateData, CalibrationRun, CertificateType } from './types';
import { cn, COLORS } from './constants';
import { generatePDF } from './lib/pdf-generator';
import GitHubSyncModal from './components/GitHubSyncModal';

const formatDateDisplay = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const d = parseISO(dateStr);
    if (!isValid(d)) return dateStr;
    return format(d, 'dd-MM-yyyy');
  } catch (e) {
    return dateStr;
  }
};

const INITIAL_RUN: CalibrationRun = {
  id: crypto.randomUUID(),
  masterVol: '',
  mutVol: '',
  comment: '',
  diff: null,
  factor: null,
  errorPct: null,
};

export default function App() {
  const [showTypeSelector, setShowTypeSelector] = useState(true);
  const [history, setHistory] = useState<CertificateData[]>([]);
  const [isManualCertNo, setIsManualCertNo] = useState(false);

  // Load isManualCertNo from local storage
  React.useEffect(() => {
    const saved = localStorage.getItem('parkvan_is_manual');
    if (saved) {
      setIsManualCertNo(saved === 'true');
    }
  }, []);

  // Save isManualCertNo to local storage
  React.useEffect(() => {
    localStorage.setItem('parkvan_is_manual', isManualCertNo.toString());
  }, [isManualCertNo]);

  // Helper to generate formatted cert number
  const generateCertNo = (type: CertificateType, dateStr: string, seq?: string) => {
    const typePrefix = type === 'Pump' ? 'P' : 'M';
    let year = '26';
    try {
      const d = parseISO(dateStr);
      year = format(d, 'yy');
    } catch (e) {}

    const targetPrefix = `PV - ${typePrefix}${year} -`;
    
    let nextSeqNum = 1;
    if (seq !== undefined) {
      nextSeqNum = parseInt(seq, 10) || 1;
    } else {
      let maxSeq = 0;
      const pattern = new RegExp(`PV\\s*-\\s*${typePrefix}${year}\\s*-\\s*(\\d+)`, 'i');
      if (history && history.length > 0) {
        history.forEach(h => {
          if (h.certNo) {
            const match = h.certNo.match(pattern);
            if (match) {
              const num = parseInt(match[1], 10);
              if (!isNaN(num) && num > maxSeq) {
                maxSeq = num;
              }
            }
          }
        });
      }
      nextSeqNum = maxSeq + 1;
    }
    
    const seqStr = String(nextSeqNum).padStart(3, '0');
    return `PV - ${typePrefix}${year} - ${seqStr}`;
  };

  const [data, setData] = useState<CertificateData>({
    certType: 'Pump',
    certNo: 'PV - P26 - 001',
    certDate: format(new Date(), 'yyyy-MM-dd'),
    nextCalDate: format(addYears(new Date(), 1), 'yyyy-MM-dd'),
    nextCalInterval: '1 Year',
    
    meterOwner: '',
    location: '',
    unitTypeVal: '',
    
    putModel: '',
    putSerial: '',
    putFlow: '',
    putAccuracy: '',
    putProduct: 'Diesel',
    putTotFinish: '',
    putTotStart: '',
    putProductDrawn: '',
    
    smModel: '',
    smSerial: '',
    smFlow: '',
    smAccuracy: '',
    smTotFinish: '',
    smTotStart: '',
    smProductDrawn: '',
    
    method: 'Master Meter',
    runs: [{ ...INITIAL_RUN }],
    
    avgError: '—',
    beforeError: '—',
    avgFactor: '—',
    adjustment: 'none',
    verdict: 'neutral',
    verdictText: 'Enter calibration data to generate verdict',
    
    techName: '',
    techInitials: '',
    authName: '',
    customerName: '',
    remarks: '',
    officialStamp: undefined,
    verificationStamp: undefined,
    authSignature: undefined,
  });

  const [editingRunId, setEditingRunId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showGitHubSync, setShowGitHubSync] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  // PWA Install Logic
  React.useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  // Load history from local storage
  React.useEffect(() => {
    const savedHistory = localStorage.getItem('parkvan_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to load history");
      }
    }
  }, []);

  // Save history to local storage
  const saveToHistory = (entry: CertificateData) => {
    setHistory(prev => {
      // Don't add if the cert number already exists in history (maybe update it?)
      const existsIdx = prev.findIndex(h => h.certNo === entry.certNo);
      let newHistory;
      if (existsIdx !== -1) {
        newHistory = [...prev];
        newHistory[existsIdx] = entry;
      } else {
        newHistory = [entry, ...prev];
      }
      // Keep only last 50 entries
      newHistory = newHistory.slice(0, 50);
      localStorage.setItem('parkvan_history', JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const loadFromHistory = (entry: CertificateData) => {
    // Merge with current defaults to ensure all fields are present
    setIsManualCertNo(true);
    setData({ ...data, ...entry });
    setShowHistory(false);
  };

  // Suggestions for clients and locations
  const clientSuggestions = useMemo(() => {
    const clients = new Set<string>();
    history.forEach(h => {
      if (h.meterOwner) clients.add(h.meterOwner);
    });
    return Array.from(clients);
  }, [history]);

  const locationSuggestions = useMemo(() => {
    const locations = new Set<string>();
    history.forEach(h => {
      if (h.location) locations.add(h.location);
    });
    return Array.from(locations);
  }, [history]);

  // Auto-save to local storage
  React.useEffect(() => {
    localStorage.setItem('parkvan_data', JSON.stringify(data));
  }, [data]);

  // Load from local storage
  React.useEffect(() => {
    const saved = localStorage.getItem('parkvan_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Basic migration/merge logic
        setData(d => ({ ...d, ...parsed }));
      } catch (e) {
        console.error("Failed to load saved data");
      }
    }
  }, []);

  const handleSaveData = () => {
    localStorage.setItem('parkvan_data', JSON.stringify(data));
    alert('Progress saved successfully');
  };

  const calculateDrawn = (finish: string, start: string) => {
    const f = parseFloat(finish);
    const s = parseFloat(start);
    if (isNaN(f) || isNaN(s)) return '';
    return (f - s).toFixed(2);
  };

  useMemo(() => {
    const putDrawn = calculateDrawn(data.putTotFinish, data.putTotStart);
    const smDrawn = calculateDrawn(data.smTotFinish, data.smTotStart);
    
    if (putDrawn !== data.putProductDrawn || smDrawn !== data.smProductDrawn) {
      setData(d => ({ 
        ...d, 
        putProductDrawn: putDrawn ? putDrawn + ' Ltrs' : '',
        smProductDrawn: smDrawn ? smDrawn + ' Ltrs' : ''
      }));
    }
  }, [data.putTotFinish, data.putTotStart, data.smTotFinish, data.smTotStart]);

  // Sync Cert No and Next Calibration Date when base values change
  React.useEffect(() => {
    setData(prev => {
      const updates: any = {};
      
      // 1. Sync Certificate Number
      if (!isManualCertNo) {
        const newNo = generateCertNo(prev.certType, prev.certDate);
        if (newNo !== prev.certNo) {
          updates.certNo = newNo;
        }
      }
      
      // 2. Sync Next Calibration Date (if interval is not 'Other')
      if (prev.nextCalInterval !== 'Other') {
        try {
          const baseDate = parseISO(prev.certDate);
          if (isValid(baseDate)) {
            let nextDate = prev.certDate;
            if (prev.nextCalInterval === '6 Months') {
              nextDate = format(addMonths(baseDate, 6), 'yyyy-MM-dd');
            } else if (prev.nextCalInterval === '1 Year') {
              nextDate = format(addYears(baseDate, 1), 'yyyy-MM-dd');
            }
            
            if (nextDate !== prev.nextCalDate) {
              updates.nextCalDate = nextDate;
            }
          }
        } catch (e) {}
      }
      
      if (Object.keys(updates).length > 0) {
        return { ...prev, ...updates };
      }
      return prev;
    });
  }, [data.certDate, data.certType, data.nextCalInterval, history, isManualCertNo]);

  const calculateRun = (mvStr: string, mevStr: string) => {
    const mv = parseFloat(mvStr);
    const mev = parseFloat(mevStr);
    if (isNaN(mv) || isNaN(mev)) return { diff: null, factor: null, errorPct: null };
    
    const diff = mv - mev;
    const factor = mv / mev;
    const errorPct = ((mv - mev) / mv) * 100;
    
    return { diff, factor, errorPct };
  };

  const updateRun = (id: string, field: keyof CalibrationRun, value: string) => {
    setData(prev => {
      const newRuns = prev.runs.map(run => {
        if (run.id === id) {
          const updated = { ...run, [field]: value };
          const stats = calculateRun(updated.masterVol, updated.mutVol);
          return { ...updated, ...stats };
        }
        return run;
      });
      return { ...prev, runs: newRuns };
    });
  };

  const addRun = () => {
    setData(prev => ({
      ...prev,
      runs: [...prev.runs, { ...INITIAL_RUN, id: crypto.randomUUID() }]
    }));
  };

  const removeRun = (id: string) => {
    if (data.runs.length <= 1) return;
    setData(prev => ({
      ...prev,
      runs: prev.runs.filter(r => r.id !== id)
    }));
  };

  const summary = useMemo(() => {
    const validRuns = data.runs.filter(r => r.errorPct !== null);
    if (validRuns.length === 0) return { avgError: '—', avgFactor: '—', beforeError: '—', verdict: 'neutral', verdictText: 'Enter calibration data to generate verdict' };

    // Find indices
    const firstAdjustedIdx = data.runs.findIndex(r => r.comment === 'Adjusted');
    const lastWettingIdx = [...data.runs].reverse().findIndex(r => r.comment === 'Wetting');
    const lastAdjustedIdx = [...data.runs].reverse().findIndex(r => r.comment === 'Adjusted');

    const lastWettingActualIdx = lastWettingIdx !== -1 ? data.runs.length - 1 - lastWettingIdx : -1;
    const lastAdjustedActualIdx = lastAdjustedIdx !== -1 ? data.runs.length - 1 - lastAdjustedIdx : -1;

    // 1. Before Adjustment Error: Average of runs AFTER wetting but BEFORE first adjustment
    // If no adjustment, it's everything after wetting
    let beforeRuns = [];
    if (firstAdjustedIdx !== -1) {
      beforeRuns = data.runs.slice(lastWettingActualIdx + 1, firstAdjustedIdx).filter(r => r.errorPct !== null);
    } else {
      beforeRuns = data.runs.slice(lastWettingActualIdx + 1).filter(r => r.errorPct !== null);
    }

    // 2. Final Runs: Only readings with "Final" under comments
    const finalRuns = data.runs.filter(r => r.comment === 'Final' && r.errorPct !== null);

    const avgBeforeError = beforeRuns.length > 0 
      ? beforeRuns.reduce((acc, r) => acc + (r.errorPct || 0), 0) / beforeRuns.length 
      : null;

    const avgFinalError = finalRuns.length > 0 
      ? finalRuns.reduce((acc, r) => acc + (r.errorPct || 0), 0) / finalRuns.length 
      : null;
    
    const avgFinalFactor = finalRuns.length > 0
      ? finalRuns.reduce((acc, r) => acc + (r.factor || 0), 0) / finalRuns.length
      : null;

    const displayError = avgFinalError !== null ? avgFinalError.toFixed(2) + '%' : '—';
    const displayFactor = avgFinalFactor !== null ? avgFinalFactor.toFixed(4) : '—';
    const displayBefore = avgBeforeError !== null ? avgBeforeError.toFixed(2) + '%' : '—';
    
    let verdict: 'pass' | 'fail' | 'neutral' = 'neutral';
    let verdictText = '';
    
    if (data.adjustment === 'made' || firstAdjustedIdx !== -1) {
      verdict = avgFinalError !== null && Math.abs(avgFinalError) <= 0.5 ? 'pass' : 'fail';
      verdictText = verdict === 'pass' 
        ? `✓ ADJUSTMENTS MADE — Verified. Final Avg error: ${displayError}`
        : `✗ ADJUSTMENTS MADE — Still outside tolerance. Final Avg error: ${displayError}`;
    } else if (avgFinalError !== null && Math.abs(avgFinalError) <= 0.5) {
      verdict = 'pass';
      verdictText = `✓ NO ADJUSTMENTS REQUIRED — Within tolerance. Avg error: ${displayError}`;
    } else if (avgFinalError !== null) {
      verdict = 'fail';
      verdictText = `✗ OUT OF TOLERANCE — Adjustment recommended. Avg error: ${displayError}`;
    }
    
    return { 
      avgError: displayError, 
      avgFactor: displayFactor,
      beforeError: displayBefore,
      verdict,
      verdictText
    };
  }, [data.runs, data.adjustment]);

  const handleNextCalChange = (interval: string) => {
    setData(prev => ({ ...prev, nextCalInterval: interval }));
  };

  const handleExport = async () => {
    // Attempt to convert logo to base64 for PDF inclusion using canvas
    let logoBase64 = '';
    const rawLogoUrl = "https://raw.githubusercontent.com/ParkvanCal/ParkvanCal/main/images/PVC%20Logo.png";
    
    try {
      logoBase64 = await new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          } else {
            reject(new Error('Canvas context failed'));
          }
        };
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = rawLogoUrl;
      });
    } catch (e) {
      console.warn("Could not convert logo to base64 via canvas", e);
      // Fallback to fetch if canvas fails (less likely to succeed if canvas fails due to CORS, but good as a last resort)
      try {
        const response = await fetch(rawLogoUrl);
        const blob = await response.blob();
        logoBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch (fetchErr) {
        console.warn("Fetch fallback also failed", fetchErr);
      }
    }

    const finalData = {
      ...data,
      avgError: summary.avgError,
      beforeError: summary.beforeError,
      avgFactor: summary.avgFactor,
      verdict: summary.verdict as 'pass' | 'fail' | 'neutral',
      verdictText: summary.verdictText || 'Enter calibration data'
    };

    // Save to history on export
    saveToHistory(finalData as any);

    try {
      await generatePDF(finalData, logoBase64);
    } catch (error) {
      console.error("PDF Generation failed:", error);
    }
  };

  const resetForm = () => {
    if (confirm('Are you sure you want to clear all fields?')) {
      setIsManualCertNo(false);
      setData(prev => ({
        ...prev,
        meterOwner: '',
        location: '',
        unitTypeVal: '',
        putModel: '',
        putSerial: '',
        putFlow: '',
        putAccuracy: '',
        putTotFinish: '',
        putTotStart: '',
        putProductDrawn: '',
        smModel: '',
        smSerial: '',
        smFlow: '',
        smAccuracy: '',
        smTotFinish: '',
        smTotStart: '',
        smProductDrawn: '',
        runs: [{ ...INITIAL_RUN, id: crypto.randomUUID() }],
        techName: '',
        techInitials: '',
        authName: '',
        customerName: '',
        remarks: '',
        officialStamp: undefined,
        verificationStamp: undefined,
        authSignature: undefined,
      }));
    }
  };

  if (showTypeSelector) {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-4 bg-navy z-50">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-navy-mid border-t-4 border-gold p-8 rounded-xl shadow-2xl max-w-lg w-full text-center"
        >
          <h2 className="text-gold-lt text-2xl font-bold mb-2 uppercase tracking-wide">Select Certificate Type</h2>
          <p className="text-blue-300/80 mb-8">What equipment is being calibrated?</p>
          
          <div className="grid grid-cols-2 gap-6">
            <motion.button 
              whileHover={{ scale: 1.05, boxShadow: "0 0 15px rgba(212, 175, 55, 0.3)" }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { 
                setIsManualCertNo(false);
                setData(d => ({ 
                  ...d, 
                  certType: 'Pump', 
                  certNo: generateCertNo('Pump', d.certDate) 
                })); 
                setShowTypeSelector(false); 
              }}
              className="group bg-navy border border-navy-lite p-6 rounded-lg hover:border-gold transition-all duration-300 text-center"
            >
              <div className="w-12 h-12 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-gold/20">
                <FlaskConical className="text-gold" />
              </div>
              <h3 className="text-gold-lt font-bold mb-1">PUMP</h3>
              <p className="text-xs text-blue-300/60 leading-tight">Pump Verification<br/>Certificate</p>
            </motion.button>
            
            <motion.button 
              whileHover={{ scale: 1.05, boxShadow: "0 0 15px rgba(212, 175, 55, 0.3)" }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { 
                setIsManualCertNo(false);
                setData(d => ({ 
                  ...d, 
                  certType: 'Meter', 
                  certNo: generateCertNo('Meter', d.certDate) 
                })); 
                setShowTypeSelector(false); 
              }}
              className="group bg-navy border border-navy-lite p-6 rounded-lg hover:border-gold transition-all duration-300 text-center"
            >
              <div className="w-12 h-12 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-gold/20">
                <Gauge className="text-gold" />
              </div>
              <h3 className="text-gold-lt font-bold mb-1">METER</h3>
              <p className="text-xs text-blue-300/60 leading-tight">Meter Verification<br/>Certificate</p>
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col max-w-6xl mx-auto py-8 px-4">
      {/* History Modal */}
      <AnimatePresence>
        {showHistory && (
          <HistoryModal 
            history={history} 
            onClose={() => setShowHistory(false)} 
            onLoad={loadFromHistory}
            onDelete={(certNo) => {
              const newHistory = history.filter(h => h.certNo !== certNo);
              setHistory(newHistory);
              localStorage.setItem('parkvan_history', JSON.stringify(newHistory));
            }}
          />
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <PreviewModal 
            data={{
              ...data, 
              avgError: summary.avgError, 
              avgFactor: summary.avgFactor, 
              beforeError: summary.beforeError,
              verdict: summary.verdict as any, 
              verdictText: summary.verdictText
            } as any} 
            onClose={() => setShowPreview(false)} 
            onExport={handleExport}
          />
        )}
      </AnimatePresence>

      {/* GitHub Sync Modal */}
      <AnimatePresence>
        {showGitHubSync && (
          <GitHubSyncModal 
            history={history} 
            currentData={{
              ...data,
              avgError: summary.avgError,
              avgFactor: summary.avgFactor,
              beforeError: summary.beforeError,
              verdict: summary.verdict as any,
              verdictText: summary.verdictText
            } as any}
            onClose={() => setShowGitHubSync(false)} 
            onRestore={(restoredHistory) => {
              setHistory(restoredHistory);
              localStorage.setItem('parkvan_history', JSON.stringify(restoredHistory));
            }}
          />
        )}
      </AnimatePresence>

      {/* App Bar */}
      <header className="bg-navy-mid border-b border-gold h-20 px-6 flex items-center justify-between rounded-t-xl shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-16 h-12 flex items-center justify-center">
            <img 
              src="https://raw.githubusercontent.com/ParkvanCal/ParkvanCal/main/images/PVC%20Logo.png" 
              alt="Parkvan Logo" 
              className="max-h-full max-w-full object-contain"
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
            />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold text-gold-lt leading-none tracking-tight">Parkvan</h1>
            <span className="text-[10px] text-blue-300/60 tracking-[0.2em] uppercase mt-1 block">Calibration Services</span>
          </div>
          <div className="ml-4 px-3 py-1 bg-gold text-navy text-[10px] font-bold rounded uppercase tracking-wider">
            {data.certType} Certificate
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {installPrompt && (
            <motion.button 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05, backgroundColor: COLORS.GOLD, color: COLORS.NAVY }}
              whileTap={{ scale: 0.95 }}
              onClick={handleInstall} 
              className="flex items-center gap-2 px-3 py-1.5 text-xs bg-gold/20 text-gold border border-gold/30 rounded transition-all font-bold"
            >
              <Download size={14} /> Install App
            </motion.button>
          )}
          <motion.button 
            whileHover={{ scale: 1.05, backgroundColor: "rgba(10, 25, 41, 0.8)" }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowHistory(true)} 
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-gold-lt hover:bg-navy rounded transition-all"
          >
            <History size={14} /> History
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.05, backgroundColor: "rgba(10, 25, 41, 0.8)" }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowGitHubSync(true)} 
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-gold-lt hover:bg-navy rounded transition-all"
          >
            <Github size={14} /> GitHub Sync
          </motion.button>
           <motion.button 
             whileHover={{ scale: 1.05, backgroundColor: "rgba(10, 25, 41, 0.8)" }}
             whileTap={{ scale: 0.95 }}
             onClick={() => setShowTypeSelector(true)} 
             className="flex items-center gap-2 px-3 py-1.5 text-xs text-gold-lt hover:bg-navy rounded transition-all"
           >
            <RefreshCcw size={14} /> Change Type
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.05, backgroundColor: "rgba(10, 25, 41, 0.8)" }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSaveData} 
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-gold-lt hover:bg-navy rounded transition-all"
          >
            <Settings size={14} /> Save Progress
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.05, backgroundColor: "rgba(10, 25, 41, 0.8)" }}
            whileTap={{ scale: 0.95 }}
            onClick={resetForm} 
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-gold-lt hover:bg-navy rounded transition-all"
          >
            <RefreshCcw size={14} /> Reset
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-2 bg-gold hover:bg-gold-lt text-navy px-4 py-2 text-sm font-bold rounded shadow-lg shadow-gold/20 transition-all"
          >
            <FileText size={16} /> Preview
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.05, y: -2, backgroundColor: COLORS.GOLD, color: COLORS.NAVY }}
            whileTap={{ scale: 0.95 }}
            onClick={handleExport}
            className="flex items-center gap-2 border-2 border-gold text-gold hover:bg-gold hover:text-navy px-4 py-2 text-sm font-bold rounded shadow-lg shadow-gold/10 transition-all"
          >
            <Download size={16} /> Export PDF
          </motion.button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-navy/50 backdrop-blur-sm border-x border-b border-navy-lite/50 p-8 space-y-12">
        
        {/* Certificate Details */}
        <section>
          <SectionHeader title="Certificate Details" icon={<FileText size={18} />} primary />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
            <Input label="Certificate No." value={data.certNo} onChange={v => { setIsManualCertNo(true); setData(d => ({ ...d, certNo: v })); }} className="text-gold-lt font-bold" />
            <Input label="Date of Calibration" type="date" value={data.certDate} onChange={v => setData(d => ({ ...d, certDate: v }))} />
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-blue-300 block">Next Cal Interval</label>
              <select 
                value={data.nextCalInterval} 
                onChange={e => handleNextCalChange(e.target.value)}
                className="w-full bg-navy border border-navy-lite text-white px-3 py-2 rounded focus:outline-none focus:border-gold transition-colors text-sm"
              >
                <option value="6 Months">6 Months</option>
                <option value="1 Year">1 Year</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <Input label="Next Calibration Date" type={data.nextCalInterval === 'Other' ? 'date' : 'text'} value={data.nextCalDate} onChange={v => setData(d => ({ ...d, nextCalDate: v }))} readOnly={data.nextCalInterval !== 'Other'} className="text-gold" />
          </div>
        </section>

        {/* Client Info */}
        <section>
          <SectionHeader title="Client Information" icon={<User size={18} />} />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
              <Input 
                label="Meter Owner" 
                value={data.meterOwner} 
                onChange={(v: string) => setData(d => ({ ...d, meterOwner: v }))} 
                placeholder="e.g. Puma Energy" 
                icon={<Factory size={14} className="text-blue-300/40" />} 
                suggestions={clientSuggestions}
              />
              <Input 
                label="Location / Place" 
                value={data.location} 
                onChange={(v: string) => setData(d => ({ ...d, location: v }))} 
                placeholder="e.g. Msasa Depot" 
                icon={<MapPin size={14} className="text-blue-300/40" />} 
                suggestions={locationSuggestions}
              />
              <Input label={data.certType === 'Pump' ? 'Pump Type' : 'Meter Type'} value={data.unitTypeVal} onChange={(v: string) => setData(d => ({ ...d, unitTypeVal: v }))} placeholder="e.g. Tatsuno Dispenser" />
            </div>
            <ImageUpload 
              label="Official Stamp" 
              value={data.officialStamp} 
              onUpload={v => setData(d => ({ ...d, officialStamp: v }))}
              onClear={() => setData(d => ({ ...d, officialStamp: undefined }))}
            />
          </div>
        </section>

        {/* Units Configuration */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* MUT Section */}
          <section>
            <SectionHeader title={data.certType === 'Pump' ? 'Pump Under Test' : 'Meter Under Test'} icon={<Gauge size={18} />} />
            <div className="space-y-6 mt-6">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Model" value={data.putModel} onChange={v => setData(d => ({ ...d, putModel: v }))} />
                <Input label="Serial No." value={data.putSerial} onChange={v => setData(d => ({ ...d, putSerial: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Flow Rates" value={data.putFlow} onChange={v => setData(d => ({ ...d, putFlow: v }))} />
                <Input label="Accuracy" value={data.putAccuracy} onChange={v => setData(d => ({ ...d, putAccuracy: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-4 items-end">
                 <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-blue-300 block">Product Used</label>
                  <select 
                    value={['Diesel', 'Petrol', 'Jet A1'].includes(data.putProduct) ? data.putProduct : 'Other'} 
                    onChange={e => {
                      const val = e.target.value;
                      setData(d => ({ ...d, putProduct: val === 'Other' ? '' : val }));
                    }}
                    className="w-full bg-navy border border-navy-lite text-white px-3 py-2 rounded focus:outline-none focus:border-gold transition-colors text-sm"
                  >
                    <option value="Diesel">Diesel</option>
                    <option value="Petrol">Petrol</option>
                    <option value="Jet A1">Jet A1</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {!['Diesel', 'Petrol', 'Jet A1'].includes(data.putProduct) && (
                  <Input 
                    label="Specify Product" 
                    value={data.putProduct} 
                    onChange={v => setData(d => ({ ...d, putProduct: v }))} 
                  />
                )}
              </div>

              {/* Totalizers */}
              <div className="p-4 rounded-lg transition-all bg-navy-lite/20 border border-navy-lite">
                <h4 className="text-[10px] font-bold text-gold-lt uppercase mb-4 flex items-center gap-2">
                  Totaliser Readings
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <Input label="Tot. Finish" value={data.putTotFinish} onChange={v => setData(d => ({ ...d, putTotFinish: v }))} />
                  <Input label="Tot. Start" value={data.putTotStart} onChange={v => setData(d => ({ ...d, putTotStart: v }))} />
                  <Input label="Product Drawn" value={data.putProductDrawn} onChange={v => setData(d => ({ ...d, putProductDrawn: v }))} readOnly />
                </div>
              </div>
            </div>
          </section>

          {/* SM Section */}
          <section>
            <SectionHeader title="Standard Measure" icon={<FlaskConical size={18} />} />
            <div className="space-y-6 mt-6">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Model" value={data.smModel} onChange={v => setData(d => ({ ...d, smModel: v }))} />
                <Input label="Serial No." value={data.smSerial} onChange={v => setData(d => ({ ...d, smSerial: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Flow Rates" value={data.smFlow} onChange={v => setData(d => ({ ...d, smFlow: v }))} />
                <Input label="Accuracy" value={data.smAccuracy} onChange={v => setData(d => ({ ...d, smAccuracy: v }))} />
              </div>
              <div className="h-[52px]"></div> {/* Spacer to align */}

              {/* Totalizers */}
              <div className={cn("p-4 rounded-lg transition-all", data.method === 'Master Meter' ? "bg-navy-lite/20 border border-navy-lite" : "opacity-30 pointer-events-none")}>
                 <h4 className="text-[10px] font-bold text-gold-lt uppercase mb-4 flex items-center gap-2">
                  Totaliser Readings <span className="text-[8px] normal-case font-normal text-blue-300/60 whitespace-nowrap">(only for Master Meter method)</span>
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <Input label="Tot. Finish" value={data.smTotFinish} onChange={v => setData(d => ({ ...d, smTotFinish: v }))} />
                  <Input label="Tot. Start" value={data.smTotStart} onChange={v => setData(d => ({ ...d, smTotStart: v }))} />
                  <Input label="Product Drawn" value={data.smProductDrawn} onChange={v => setData(d => ({ ...d, smProductDrawn: v }))} />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Method */}
        <section>
          <SectionHeader title="Calibration Method" icon={<Clock size={18} />} />
          <div className="mt-6 flex flex-wrap items-center gap-8 bg-navy-mid/30 p-6 rounded-lg border border-navy-lite/50">
             <div className="space-y-1.5 flex-1 max-w-xs">
              <label className="text-[10px] uppercase font-bold text-blue-300 block">Method Used</label>
              <select 
                value={['Master Meter', 'Volumetric', 'Prover Tank', 'Measuring Can'].includes(data.method) ? data.method : 'Other'} 
                onChange={e => {
                  const val = e.target.value;
                  setData(d => ({ ...d, method: val === 'Other' ? '' : val }));
                }}
                className="w-full bg-navy border border-navy-lite text-white px-3 py-2 rounded focus:outline-none focus:border-gold transition-colors text-sm"
              >
                <option value="Master Meter">Master Meter</option>
                <option value="Volumetric">Volumetric</option>
                <option value="Prover Tank">Prover Tank</option>
                <option value="Measuring Can">Measuring Can</option>
                <option value="Other">Other</option>
              </select>
            </div>
            {!['Master Meter', 'Volumetric', 'Prover Tank', 'Measuring Can'].includes(data.method) && (
              <div className="flex-1 max-w-xs">
                <Input 
                  label="Specify Method" 
                  value={data.method} 
                  onChange={v => setData(d => ({ ...d, method: v }))} 
                />
              </div>
            )}
          </div>
        </section>

        {/* Results Table */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <SectionHeader title="Calibration Results" icon={<ChevronRight size={18} />} />
            <motion.button 
              whileHover={{ scale: 1.05, backgroundColor: "rgba(30, 58, 138, 0.4)" }}
              whileTap={{ scale: 0.95 }}
              onClick={addRun}
              className="flex items-center gap-2 bg-navy-lite hover:bg-navy-lite/80 text-gold-lt px-3 py-1.5 text-xs font-bold rounded transition-all"
            >
              <Plus size={14} /> Add Run
            </motion.button>
          </div>
          
          <div className="bg-navy-mid/30 rounded-lg border border-navy-lite/50 overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-navy text-[10px] uppercase font-bold text-gold-lt">
                  <th className="px-4 py-3 text-center border-r border-navy-lite/30 w-12 text-blue-300">Run</th>
                  <th className="px-4 py-3 text-center border-r border-navy-lite/30">Standard Vol (L)</th>
                  <th className="px-4 py-3 text-center border-r border-navy-lite/30">{data.certType === 'Pump' ? 'PUT Vol (L)' : 'MUT Vol (L)'}</th>
                  <th className="px-4 py-3 text-center border-r border-navy-lite/30">Diff (L)</th>
                  <th className="px-4 py-3 text-center border-r border-navy-lite/30">Meter Factor</th>
                  <th className="px-4 py-3 text-center border-r border-navy-lite/30">% Error</th>
                  <th className="px-4 py-3 text-left">Comments</th>
                  <th className="px-4 py-3 text-center w-16"></th>
                </tr>
              </thead>
              <tbody className="text-sm font-mono">
                {data.runs.map((run, idx) => (
                  <tr key={run.id} className="border-t border-navy-lite/30 group hover:bg-navy-lite/10 transition-colors">
                    <td className="px-4 py-2 text-center border-r border-navy-lite/30 bg-navy/50 text-[11px] font-bold text-gold">{idx + 1}</td>
                    <td className="px-2 py-1 border-r border-navy-lite/30">
                      <input 
                        type="text" 
                        value={run.masterVol} 
                        onChange={(e) => updateRun(run.id, 'masterVol', e.target.value)}
                        className="w-full bg-transparent border-none focus:outline-none text-center"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-2 py-1 border-r border-navy-lite/30">
                      <input 
                        type="text" 
                        value={run.mutVol} 
                        onChange={(e) => updateRun(run.id, 'mutVol', e.target.value)}
                        className="w-full bg-transparent border-none focus:outline-none text-center"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-4 py-2 text-center border-r border-navy-lite/30 text-blue-300/60">
                      {run.diff !== null ? run.diff.toFixed(3) : '—'}
                    </td>
                    <td className="px-4 py-2 text-center border-r border-navy-lite/30 text-blue-300/60">
                      {run.factor !== null ? run.factor.toFixed(4) : '—'}
                    </td>
                    <td className={cn(
                      "px-4 py-2 text-center border-r border-navy-lite/30 font-bold",
                      run.errorPct === null ? "text-blue-300/60" : Math.abs(run.errorPct) > 0.5 ? "text-red-400" : "text-green-400"
                    )}>
                      {run.errorPct !== null ? run.errorPct.toFixed(2) + '%' : '—'}
                    </td>
                    <td className="px-2 py-1">
                      <select 
                        value={run.comment} 
                        onChange={(e) => updateRun(run.id, 'comment', e.target.value)}
                        className="w-full bg-transparent border-none focus:outline-none text-[11px] text-blue-300/80 cursor-pointer"
                      >
                        <option value="" className="bg-navy">Select...</option>
                        <option value="Wetting" className="bg-navy">Wetting</option>
                        <option value="Stabilising" className="bg-navy">Stabilising</option>
                        <option value="Adjusted" className="bg-navy">Adjusted</option>
                        <option value="Final" className="bg-navy">Final</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <motion.button 
                        whileHover={data.runs.length > 1 ? { scale: 1.15 } : {}}
                        whileTap={data.runs.length > 1 ? { scale: 0.9 } : {}}
                        onClick={() => {
                          if (data.runs.length > 1) {
                            removeRun(run.id);
                          }
                        }}
                        disabled={data.runs.length <= 1}
                        className={cn(
                          "p-1.5 rounded transition-all",
                          data.runs.length <= 1 
                            ? "text-blue-300/20 cursor-not-allowed opacity-50" 
                            : "text-red-400/80 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                        )}
                        title={data.runs.length <= 1 ? "Cannot delete the only remaining run" : "Delete run"}
                      >
                        <Trash2 size={14} />
                      </motion.button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Summary */}
        <section>
          <SectionHeader title="Summary" icon={<FileText size={18} />} />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
            <SummaryCard 
              label="% Error" 
              subLabel="Before Adjustment" 
              value={summary.beforeError} 
              color={summary.beforeError !== '—' && Math.abs(parseFloat(summary.beforeError)) > 0.5 ? 'red' : 'green'} 
            />
            
            <div className="bg-navy-mid/50 border border-navy-lite p-6 rounded-lg flex flex-col items-center gap-4">
              <span className="text-[10px] font-bold text-blue-300/60 uppercase">Adjustment Status</span>
              <select 
                value={data.adjustment}
                onChange={e => setData(d => ({ ...d, adjustment: e.target.value as 'none' | 'made' }))}
                className="w-full bg-navy border border-navy-lite text-gold-lt px-3 py-2 rounded focus:outline-none focus:border-gold transition-colors text-sm font-bold text-center"
              >
                <option value="none">No Adjustments Made</option>
                <option value="made">Adjustments Made</option>
              </select>
            </div>

            <SummaryCard 
              label="Final Avg % Error" 
              subLabel="Post Adjustment" 
              value={summary.avgError} 
              color={summary.avgError !== '—' && Math.abs(parseFloat(summary.avgError)) > 0.5 ? 'red' : 'green'} 
            />

            <SummaryCard label="Avg Meter Factor" subLabel="Final Result" value={summary.avgFactor} />
          </div>

          <div className={cn(
            "mt-8 p-6 rounded-lg border-2 flex items-center gap-4 transition-all",
            summary.verdict === 'pass' ? "bg-green-900/10 border-green-500/30 text-green-400" : 
            summary.verdict === 'fail' ? "bg-red-900/10 border-red-500/30 text-red-400" : 
            "bg-navy-lite/10 border-navy-lite text-blue-300"
          )}>
            {summary.verdict === 'pass' ? <CheckCircle2 size={24} /> : summary.verdict === 'fail' ? <AlertCircle size={24} /> : <FileText size={24} />}
            <p className="font-bold tracking-wide">{summary.verdictText}</p>
          </div>
        </section>

        {/* Sign-off */}
        <section>
          <SectionHeader title="Authorisation & Sign-off" icon={<User size={18} />} />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
             <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <Input label="Calibration Technician" value={data.techName} onChange={v => setData(d => ({ ...d, techName: v }))} placeholder="Full Name" />
                  <Input label="Technician Initials" value={data.techInitials} onChange={v => setData(d => ({ ...d, techInitials: v }))} placeholder="Initials (required)" />
                </div>
                <div className="space-y-4">
                  <Input label="Authorised Signatory" value={data.authName} onChange={v => setData(d => ({ ...d, authName: v }))} placeholder="Full Name" />
                  <ImageUpload 
                    label="Authoriser Signature" 
                    value={data.authSignature} 
                    onUpload={v => setData(d => ({ ...d, authSignature: v }))}
                    onClear={() => setData(d => ({ ...d, authSignature: undefined }))}
                  />
                </div>
                <div className="space-y-4">
                  <Input label="Customer Representative" value={data.customerName} onChange={v => setData(d => ({ ...d, customerName: v }))} placeholder="Full Name" />
                </div>
             </div>
             <ImageUpload 
               label="Verification Stamp" 
               value={data.verificationStamp} 
               onUpload={v => setData(d => ({ ...d, verificationStamp: v }))}
               onClear={() => setData(d => ({ ...d, verificationStamp: undefined }))}
             />
          </div>
          
          <div className="mt-8 space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-blue-300 block">Remarks / Additional Notes</label>
            <textarea 
              value={data.remarks}
              onChange={e => setData(d => ({ ...d, remarks: e.target.value }))}
              placeholder="Any additional observations or conditions..."
              rows={3}
              className="w-full bg-navy border border-navy-lite text-white px-4 py-3 rounded focus:outline-none focus:border-gold transition-colors text-sm"
            />
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="bg-navy h-12 flex items-center justify-between px-6 border-t border-gold rounded-b-xl shrink-0 opacity-50">
        <span className="text-[10px] text-blue-300">Parkvan Calibration Services &bull; Fuel Metering &bull; 2026</span>
        <span className="text-[10px] text-gold font-bold">{data.certNo}</span>
      </footer>
    </div>
  );
}

function SectionHeader({ title, icon, primary = false }: { title: string, icon: React.ReactNode, primary?: boolean }) {
  const bg = primary ? "bg-navy-mid" : "bg-navy-lite/30";
  return (
    <div className={cn("flex items-center gap-3 p-3 rounded-r-lg border-l-4 border-gold", bg)}>
      <span className="text-gold">{icon}</span>
      <h2 className="text-[11px] font-bold text-gold-lt uppercase tracking-widest">{title}</h2>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", readOnly = false, className = "", placeholder = "", icon, suggestions = [] }: any) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const filteredSuggestions = suggestions.filter((s: string) => 
    s.toLowerCase().includes((value || '').toLowerCase()) && s !== value
  );

  return (
    <div className="space-y-1.5 flex-1 w-full relative">
      <label className="text-[10px] uppercase font-bold text-blue-300 block leading-none">{label}</label>
      <div className="relative group">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">{icon}</div>}
        <input 
          type={type} 
          value={value} 
          onChange={e => onChange?.(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          readOnly={readOnly}
          placeholder={placeholder}
          className={cn(
            "w-full bg-navy border border-navy-lite text-white px-3 py-2 rounded focus:outline-none focus:border-gold transition-colors text-sm",
            readOnly && "bg-navy-mid border-transparent cursor-default",
            icon && "pl-9",
            className
          )}
        />
        
        <AnimatePresence>
          {showSuggestions && filteredSuggestions.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute left-0 right-0 top-full mt-1 bg-navy border border-gold/30 rounded shadow-xl z-50 max-h-40 overflow-auto"
            >
              {filteredSuggestions.map((s: string, i: number) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    onChange(s);
                    setShowSuggestions(false);
                  }}
                  className="w-full text-left px-3 py-2 text-[10px] text-gold-lt hover:bg-navy-lite transition-colors border-b border-navy-lite last:border-0"
                >
                  {s}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function HistoryModal({ history, onClose, onLoad, onDelete }: { history: CertificateData[], onClose: () => void, onLoad: (entry: CertificateData) => void, onDelete: (certNo: string) => void }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredHistory = history.filter(h => 
    h.certNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    h.meterOwner.toLowerCase().includes(searchTerm.toLowerCase()) ||
    h.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-navy/90 backdrop-blur-md z-[60] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-navy-mid w-full max-w-3xl h-[80vh] rounded-xl overflow-hidden border border-gold/30 shadow-2xl flex flex-col"
      >
        <div className="bg-navy p-4 flex items-center justify-between border-b border-gold/10">
          <div className="flex items-center gap-3">
            <History className="text-gold" size={20} />
            <h3 className="text-gold-lt font-bold uppercase tracking-widest text-sm">Certificate History</h3>
          </div>
          <button onClick={onClose} className="text-blue-300/60 hover:text-white transition-colors">
            <Plus className="rotate-45" size={24} />
          </button>
        </div>

        <div className="p-4 bg-navy/50 border-b border-gold/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gold/50" size={16} />
            <input 
              type="text"
              placeholder="Search by Certificate No, Client, or Location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-navy border border-navy-lite text-white rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-gold transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3">
          {filteredHistory.length > 0 ? (
            filteredHistory.map((entry) => (
              <motion.div 
                key={entry.certNo}
                whileHover={{ scale: 1.01 }}
                className="bg-navy/40 border border-navy-lite p-4 rounded-lg flex items-center justify-between group hover:border-gold/30 transition-all"
              >
                <div className="flex items-center gap-4 text-left">
                  <div className="w-10 h-10 bg-gold/10 rounded-full flex items-center justify-center shrink-0">
                    <BookOpen className="text-gold" size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-gold-lt font-bold text-sm tracking-wide">{entry.certNo}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-navy-lite text-blue-300/80 rounded uppercase">{entry.certType}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-white/80 font-medium">{entry.meterOwner}</span>
                      <span className="text-xs text-blue-300/60 flex items-center gap-1">
                        <MapPin size={10} /> {entry.location}
                      </span>
                    </div>
                    <p className="text-[10px] text-blue-300/40 mt-1 uppercase">Date: {formatDateDisplay(entry.certDate)}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => onLoad(entry)}
                    className="px-4 py-2 bg-gold/10 hover:bg-gold text-gold hover:text-navy text-xs font-bold rounded transition-all"
                  >
                    Load Data
                  </button>
                  <button 
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this entry?')) {
                        onDelete(entry.certNo);
                      }
                    }}
                    className="p-2 text-red-400 hover:bg-red-400/10 rounded transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
              <History size={48} className="mb-4" />
              <p className="text-sm font-medium">No certificates found in history</p>
              <p className="text-xs mt-1">Certificates are automatically saved when you export to PDF.</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function ImageUpload({ label, value, onUpload, onClear, className = "" }: { label: string, value?: string, onUpload: (base64: string) => void, onClear: () => void, className?: string }) {
  const [hovered, setHovered] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      alert("File too large. Please select an image under 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      onUpload(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-[10px] uppercase font-bold text-blue-300 block leading-none">{label}</label>
      <div 
        className="relative h-24 bg-white border border-navy-lite rounded overflow-hidden hover:border-gold transition-colors shadow-inner cursor-default"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          setIsConfirming(false);
        }}
      >
        {value ? (
          <div className="absolute inset-0 flex items-center justify-center p-2">
            <img src={value} alt={label} className="max-h-full max-w-full object-contain" />
            
            <AnimatePresence>
              {hovered && !isConfirming && (
                <>
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px] z-10 pointer-events-none" 
                  />
                  <motion.button
                    initial={{ opacity: 0, scale: 0.5, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    type="button"
                    onClick={(e) => { 
                      e.preventDefault(); 
                      e.stopPropagation();
                      setIsConfirming(true);
                    }}
                    className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-500 text-white rounded-md shadow-xl z-20 flex items-center justify-center border border-red-400 group"
                    title="Delete Image"
                  >
                    <Trash2 size={16} />
                  </motion.button>
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-2 left-0 right-0 text-center z-20 pointer-events-none"
                  >
                    <span className="text-[9px] text-gold font-bold uppercase tracking-widest bg-navy px-3 py-1 rounded border border-gold/20 shadow-md shadow-black/40">Remove {label}</span>
                  </motion.div>
                </>
              )}

              {isConfirming && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute inset-0 z-30 bg-navy flex flex-col items-center justify-center p-3 text-center"
                >
                  <p className="text-[10px] text-white font-bold leading-tight mb-2 uppercase tracking-tight">Delete this {label}?</p>
                  <div className="flex gap-2 w-full justify-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onClear();
                        setIsConfirming(false);
                      }}
                      className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-colors shadow-lg border border-red-400"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsConfirming(false);
                      }}
                      className="bg-navy-lite hover:bg-opacity-80 text-white px-3 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-colors border border-navy-lite"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-gold/5 transition-colors">
            <Plus size={16} className="text-gold mb-1" />
            <span className="text-[8px] text-navy font-bold uppercase tracking-widest text-center px-4">Upload {label}</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </label>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, subLabel, value, color }: { label: string, subLabel: string, value: string, color?: 'red' | 'green' }) {
  return (
    <div className="bg-navy-mid/50 border border-navy-lite p-6 rounded-lg flex flex-col items-center text-center">
      <span className="text-[11px] font-bold text-blue-300/80 uppercase leading-tight">{label}</span>
      <span className="text-[8px] text-blue-300/40 uppercase mb-4">{subLabel}</span>
      <div className={cn(
        "text-3xl font-mono font-bold font-serif",
        color === 'red' ? "text-red-400" : color === 'green' ? "text-green-400" : "text-gold-lt"
      )}>
        {value}
      </div>
    </div>
  );
}

function PreviewModal({ data, onClose, onExport }: { data: CertificateData, onClose: () => void, onExport: () => void }) {
  return (
    <div className="fixed inset-0 bg-navy/90 backdrop-blur-md z-[60] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="bg-white w-full max-w-4xl h-[90vh] rounded-xl overflow-hidden shadow-2xl flex flex-col"
      >
        <div className="bg-navy p-4 flex items-center justify-between">
          <h3 className="text-gold-lt font-bold uppercase tracking-widest text-sm">Certificate Preview</h3>
          <div className="flex items-center gap-3">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose} 
              className="text-blue-300/60 hover:text-white px-3 py-1.5 text-xs transition-all"
            >
              Close
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.05, y: -1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { onExport(); onClose(); }}
              className="bg-gold text-navy px-4 py-1.5 text-xs font-bold rounded hover:bg-gold-lt transition-all flex items-center gap-2 shadow-lg shadow-gold/20"
            >
              <Download size={14} /> Download PDF
            </motion.button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto bg-gray-200/50 p-8 space-y-8">
          {/* Page 1 */}
          <div className="bg-white shadow-lg mx-auto w-full max-w-[210mm] min-h-[297mm] p-10 font-sans text-navy relative flex flex-col">
            {/* Header Mirror */}
            <div className="bg-navy p-6 flex justify-between items-center text-white rounded-t">
              <div className="flex items-center gap-4">
                <div className="w-16 h-12 flex items-center justify-center bg-white/5 rounded p-2">
                  <img src="https://raw.githubusercontent.com/ParkvanCal/ParkvanCal/main/images/PVC%20Logo.png" alt="Logo" className="max-h-full" crossOrigin="anonymous" />
                </div>
                <div>
                   <h1 className="text-xl font-bold text-gold-lt leading-tight">PARKVAN</h1>
                   <p className="text-[8px] text-gold tracking-widest leading-none uppercase">Calibration Services</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[8px] text-gold uppercase tracking-widest mb-1">Certificate No.</p>
                <p className="text-lg font-bold text-gold-lt leading-none">{data.certNo}</p>
                <p className="text-[7px] text-gold mt-2">DATED: {formatDateDisplay(data.certDate)}</p>
              </div>
            </div>
            
            <div className="bg-navy border-t border-gold text-gold-lt text-center py-2 text-sm font-bold uppercase tracking-widest">
              {data.certType} Verification Certificate
            </div>

            <div className="mt-8 space-y-6 flex-1">
               <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                     <PreviewSection title="Client Information">
                        <PreviewRow label="Meter Owner" value={data.meterOwner} />
                        <PreviewRow label="Location" value={data.location} />
                        <PreviewRow label="Equipment" value={data.unitTypeVal} />
                     </PreviewSection>

                     <PreviewSection title={data.certType === 'Pump' ? 'Pump Under Test' : 'Meter Under Test'}>
                        <PreviewRow label="Model" value={data.putModel} />
                        <PreviewRow label="Serial" value={data.putSerial} />
                        <PreviewRow label="Product" value={data.putProduct} />
                        <PreviewRow label="Flow Rate" value={data.putFlow} />
                     </PreviewSection>
                  </div>

                  <div className="space-y-4">
                     <PreviewSection title="Standard Measure Info">
                        <PreviewRow label="Model" value={data.smModel} />
                        <PreviewRow label="Serial" value={data.smSerial} />
                        <PreviewRow label="Accuracy" value={data.smAccuracy} />
                        <PreviewRow label="Calibration Method" value={data.method} />
                     </PreviewSection>
                     
                     <div className="p-4 bg-gray-50 border border-navy/5 rounded">
                        <p className="text-[8px] font-bold text-navy/40 uppercase mb-2">Calibration Method</p>
                        <p className="text-[10px] font-bold text-navy">{data.method}</p>
                     </div>
                  </div>
               </div>

               <div className="italic text-[9px] text-gray-500 mt-4 border-l-2 border-gold pl-4">
                 Note: This certificate is issued in accordance with international metrology standards. 
                 The results relate only to the item calibrated.
               </div>
            </div>
            
            <div className="mt-auto flex justify-end">
               <div className={cn(
                 "w-[63.5mm] h-[12.7mm] border flex items-center justify-center text-[7px] uppercase tracking-widest overflow-hidden",
                 data.officialStamp ? "border-transparent" : "border-dashed border-gray-300 text-gray-300"
               )}>
                 {data.officialStamp ? (
                   <img src={data.officialStamp} alt="Official Stamp" className="h-full object-contain" />
                 ) : (
                   "Official Stamp / Seal"
                 )}
               </div>
            </div>

            <div className="mt-4 bg-navy border-t border-gold p-4 flex justify-between items-center text-white rounded-b">
               <div className="text-[7px]">
                  <p className="font-bold text-gold-lt">PARKVAN CALIBRATION SERVICES</p>
                  <p className="opacity-60">Fuel Metering & Compliance Division · Harare, Zimbabwe</p>
               </div>
               <div className="text-right text-[7px]">
                  <p className="text-gold">Page 1 of 2</p>
                  <p>{data.certNo}</p>
               </div>
            </div>
          </div>

          {/* Page 2 */}
          <div className="bg-white shadow-lg mx-auto w-full max-w-[210mm] min-h-[297mm] p-10 font-sans text-navy relative flex flex-col">
            <div className="bg-navy p-4 flex justify-between items-center text-white rounded-t">
               <h3 className="text-sm font-bold text-gold-lt uppercase tracking-widest">Calibration Data & Results</h3>
               <p className="text-xs text-gold font-bold">{data.certNo}</p>
            </div>

            <div className="mt-8 flex-1 space-y-8">
               {/* Results Table in Preview */}
               <div className="mt-4">
                  <table className="w-full text-[8px] border-collapse">
                    <thead>
                      <tr className="bg-navy text-gold-lt uppercase">
                        <th className="p-1 border border-navy-lite">Run</th>
                        <th className="p-1 border border-navy-lite">Standard (L)</th>
                        <th className="p-1 border border-navy-lite">{data.certType === 'Pump' ? 'PUT (L)' : 'MUT (L)'}</th>
                        <th className="p-1 border border-navy-lite">Diff</th>
                        <th className="p-1 border border-navy-lite">Factor</th>
                        <th className="p-1 border border-navy-lite">% Err</th>
                        <th className="p-1 border border-navy-lite text-left">Comment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.runs.map((run, i) => (
                        <tr key={run.id} className="border-b border-gray-100">
                          <td className="p-1 text-center font-bold text-navy bg-gray-50">{i + 1}</td>
                          <td className="p-1 text-center">{run.masterVol}</td>
                          <td className="p-1 text-center">{run.mutVol}</td>
                          <td className="p-1 text-center">{run.diff?.toFixed(3)}</td>
                          <td className="p-1 text-center">{run.factor?.toFixed(4)}</td>
                          <td className={cn("p-1 text-center font-bold", Math.abs(run.errorPct || 0) > 0.5 ? "text-red-500" : "text-green-600")}>
                            {run.errorPct?.toFixed(2)}%
                          </td>
                          <td className="p-1 text-left italic text-gray-500">{run.comment}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
               </div>

               <PreviewSection title="Calibration Summary">
                  <div className="grid grid-cols-4 gap-4">
                    <PreviewCard label="Err Before Adj." value={(data as any).beforeError} />
                    <PreviewCard label="Adjustment" value={data.adjustment === 'made' ? 'Adjusted' : 'None'} />
                    <PreviewCard label="Final Avg % Err" value={data.avgError} highlight />
                    <PreviewCard label="Avg Factor" value={data.avgFactor} />
                  </div>
               </PreviewSection>

               <div className={cn(
                 "p-4 rounded border text-center transition-all",
                 data.verdict === 'pass' ? "bg-green-50 border-green-200 text-green-800" : 
                 data.verdict === 'fail' ? "bg-red-50 border-red-200 text-red-800" : 
                 "bg-gray-50 border-gray-200 text-gray-600"
               )}>
                  <p className="font-bold text-sm uppercase tracking-wide">{data.verdictText}</p>
               </div>

               {data.remarks && (
                 <div className="bg-gray-50 border border-gray-200 p-3 rounded">
                    <p className="text-[7px] text-gray-400 uppercase font-bold mb-1">Remarks</p>
                    <p className="text-[9px] text-navy italic">{data.remarks}</p>
                 </div>
               )}
               
               <div className="grid grid-cols-2 gap-8 border-t border-navy/10 pt-8">
                  <PreviewSection title="Calibration Schedule">
                     <PreviewRow label="Calibration Date" value={formatDateDisplay(data.certDate)} />
                     <PreviewRow label="Next Due Date" value={formatDateDisplay(data.nextCalDate)} />
                  </PreviewSection>

                  <div className="space-y-4">
                     <p className="text-[8px] font-bold text-navy/40 uppercase">Authorisation & Sign-off</p>
                     <div className="grid grid-cols-2 gap-4">
                        <SignSpace 
                          label="Calibration Technician" 
                          value={data.techInitials} 
                          underline 
                        />
                        <SignSpace 
                          label="Authorised Signatory" 
                          signature={data.authSignature} 
                          name={data.authName}
                          underline
                          showNameBelow
                        />
                     </div>
                     <div className="pt-2">
                        <SignSpace 
                          label="Customer Representative" 
                          value={data.customerName} 
                          underline 
                        />
                     </div>
                  </div>
               </div>

               {/* Stamp Space 2 */}
               <div className="flex justify-end pt-8">
                  <div className={cn(
                    "w-[76.2mm] h-[40mm] border flex items-center justify-center text-[7px] uppercase tracking-widest overflow-hidden",
                    data.verificationStamp ? "border-transparent" : "border-dashed border-gray-300 text-gray-300"
                  )}>
                    {data.verificationStamp ? (
                      <img src={data.verificationStamp} alt="Verification Stamp" className="max-h-full object-contain" />
                    ) : (
                      "Verification Stamp"
                    )}
                  </div>
               </div>
            </div>
            
            <div className="mt-8 bg-navy border-t border-gold p-4 flex justify-between items-center text-white rounded-b">
               <div className="text-[7px]">
                  <p className="font-bold text-gold-lt">PARKVAN CALIBRATION SERVICES</p>
                  <p className="opacity-60">Fuel Metering & Compliance Division · Harare, Zimbabwe</p>
               </div>
               <div className="text-right text-[7px]">
                  <p className="text-gold">Page 2 of 2</p>
                  <p>{data.certNo}</p>
               </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function PreviewCard({ label, value, highlight }: { label: string, value: string, highlight?: boolean }) {
  return (
    <div className={cn("p-2 rounded text-center border", highlight ? "bg-navy text-gold-lt border-navy" : "bg-gray-50 border-gray-100")}>
       <p className="text-[6px] uppercase font-bold opacity-60 mb-1">{label}</p>
       <p className="text-[10px] font-bold">{value || '—'}</p>
    </div>
  );
}

function PreviewSection({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-[10px] font-bold text-gold bg-navy px-2 py-1 rounded-sm uppercase inline-block">{title}</h4>
      <div className="divide-y divide-gray-100">{children}</div>
    </div>
  );
}

function PreviewRow({ label, value, highlight }: { label: string, value: string, highlight?: boolean }) {
  return (
    <div className="flex justify-between py-1.5 text-[9px]">
      <span className="text-gray-500 font-medium uppercase">{label}</span>
      <span className={cn("text-navy font-bold", highlight && "text-gold bg-navy px-1 rounded")}>{value || '—'}</span>
    </div>
  );
}

function SignSpace({ label, value, name, signature, underline, showNameBelow }: { label: string, value?: string, name?: string, signature?: string, underline?: boolean, showNameBelow?: boolean }) {
  return (
    <div className="text-center space-y-1">
       <div>
          <p className="text-[7px] text-gray-400 uppercase font-bold leading-none">{label}</p>
       </div>
       <div className={cn(
         "h-8 relative flex items-center justify-center overflow-hidden",
         underline && "border-b border-navy/20 mx-4"
       )}>
          {signature ? (
            <img src={signature} alt="Signature" className="h-full object-contain" />
          ) : value ? (
            <span className="text-navy font-bold text-[10px] italic tracking-widest">{value}</span>
          ) : (
             <span className="text-navy/20 text-[11px]">........................</span>
          )}
       </div>
       {showNameBelow && (
          <p className="text-[9px] font-bold text-navy mt-1">{name || '........................'}</p>
       )}
    </div>
  );
}
