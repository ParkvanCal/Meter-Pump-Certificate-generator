import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Github, 
  Upload, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Key, 
  Folder, 
  GitBranch, 
  FileJson, 
  FileText,
  Eye, 
  EyeOff, 
  RefreshCcw,
  Check,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { CertificateData } from '../types';
import { COLORS, cn } from '../constants';
import { generatePDF } from '../lib/pdf-generator';

interface GitHubSyncModalProps {
  history: CertificateData[];
  currentData: CertificateData;
  onClose: () => void;
  onRestore: (restoredHistory: CertificateData[]) => void;
}

export default function GitHubSyncModal({ 
  history, 
  currentData, 
  onClose, 
  onRestore 
}: GitHubSyncModalProps) {
  // Config state
  const [token, setToken] = useState('');
  const [repo, setRepo] = useState('');
  const [branch, setBranch] = useState('main');
  const [dbPath, setDbPath] = useState('parkvan_history.json');
  const [showToken, setShowToken] = useState(false);

  // Operations state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isPushingDb, setIsPushingDb] = useState(false);
  const [isPullingDb, setIsPullingDb] = useState(false);
  const [isUploadingCert, setIsUploadingCert] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastSync, setLastSync] = useState<string>('');

  // Merge choice state
  const [pulledData, setPulledData] = useState<CertificateData[] | null>(null);

  // Load config from LocalStorage
  useEffect(() => {
    setToken(localStorage.getItem('pv_github_token') || '');
    setRepo(localStorage.getItem('pv_github_repo') || '');
    setBranch(localStorage.getItem('pv_github_branch') || 'main');
    setDbPath(localStorage.getItem('pv_github_db_path') || 'parkvan_history.json');
    setLastSync(localStorage.getItem('pv_github_last_sync') || '');
  }, []);

  // Save config helper
  const saveConfig = (key: string, value: string, setter: (v: string) => void) => {
    setter(value);
    localStorage.setItem(key, value);
  };

  // Safe Unicode Base64 encoding/decoding
  const toBase64 = (str: string) => {
    return btoa(unescape(encodeURIComponent(str)));
  };

  const fromBase64 = (str: string) => {
    return decodeURIComponent(escape(atob(str)));
  };

  // API helper to test connection
  const handleTestConnection = async () => {
    if (!token || !repo) {
      setTestResult({ success: false, message: 'Please enter both your Token and Repository Path.' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch(`https://api.github.com/repos/${repo}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (res.ok) {
        const repoData = await res.json();
        setTestResult({ 
          success: true, 
          message: `Connected successfully to "${repoData.name}"! Default branch is ${repoData.default_branch}.` 
        });
      } else {
        const err = await res.json();
        setTestResult({ 
          success: false, 
          message: err.message || 'Failed to connect. Please check your credentials.' 
        });
      }
    } catch (e) {
      setTestResult({ success: false, message: 'Network error. Please check your connection.' });
    } finally {
      setIsTesting(false);
    }
  };

  // Helper to fetch file SHA if it exists
  const getFileSha = async (filePath: string): Promise<string | null> => {
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (res.ok) {
        const fileInfo = await res.json();
        return fileInfo.sha;
      }
    } catch (e) {
      console.warn('Could not retrieve file SHA:', e);
    }
    return null;
  };

  // Push full database to GitHub
  const handlePushDatabase = async () => {
    if (!token || !repo) {
      setActionMessage({ type: 'error', text: 'GitHub configuration is incomplete.' });
      return;
    }

    setIsPushingDb(true);
    setActionMessage(null);

    try {
      const sha = await getFileSha(dbPath);
      const contentStr = JSON.stringify(history, null, 2);
      const contentBase64 = toBase64(contentStr);

      const res = await fetch(`https://api.github.com/repos/${repo}/contents/${dbPath}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
          message: `Backup calibration history [Parkvan ${new Date().toLocaleDateString()}]`,
          content: contentBase64,
          branch: branch,
          ...(sha ? { sha } : {})
        })
      });

      if (res.ok) {
        const nowStr = new Date().toLocaleString();
        saveConfig('pv_github_last_sync', nowStr, setLastSync);
        setActionMessage({ 
          type: 'success', 
          text: `History successfully backed up to ${dbPath} on branch ${branch}!` 
        });
      } else {
        const err = await res.json();
        setActionMessage({ type: 'error', text: err.message || 'Failed to push history file.' });
      }
    } catch (e) {
      setActionMessage({ type: 'error', text: 'Network error. Failed to backup.' });
    } finally {
      setIsPushingDb(false);
    }
  };

  // Pull full database from GitHub
  const handlePullDatabase = async () => {
    if (!token || !repo) {
      setActionMessage({ type: 'error', text: 'GitHub configuration is incomplete.' });
      return;
    }

    setIsPullingDb(true);
    setActionMessage(null);
    setPulledData(null);

    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/contents/${dbPath}?ref=${branch}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (res.ok) {
        const fileInfo = await res.json();
        const contentStr = fromBase64(fileInfo.content.replace(/\s/g, ''));
        const parsedHistory = JSON.parse(contentStr);

        if (Array.isArray(parsedHistory)) {
          setPulledData(parsedHistory);
          setActionMessage({ 
            type: 'success', 
            text: `Found ${parsedHistory.length} records. Please select restore method below.` 
          });
        } else {
          setActionMessage({ type: 'error', text: 'The retrieved file is not a valid calibration history.' });
        }
      } else {
        const err = await res.json();
        setActionMessage({ type: 'error', text: err.message || 'Failed to find file in repository.' });
      }
    } catch (e) {
      setActionMessage({ type: 'error', text: 'Network error or corrupted file format.' });
    } finally {
      setIsPullingDb(false);
    }
  };

  // Apply restored database (Overwrite or Merge)
  const applyRestore = (overwrite: boolean) => {
    if (!pulledData) return;

    let finalHistory: CertificateData[] = [];
    if (overwrite) {
      finalHistory = pulledData;
    } else {
      // Merge: Keep all unique records by certNo, prioritizing local ones if duplicate, or pulled ones
      const localMap = new Map(history.map(h => [h.certNo, h]));
      pulledData.forEach(p => {
        // Only set if not already present in local history
        if (!localMap.has(p.certNo)) {
          localMap.set(p.certNo, p);
        }
      });
      finalHistory = Array.from(localMap.values());
    }

    onRestore(finalHistory);
    setPulledData(null);
    setActionMessage({ 
      type: 'success', 
      text: `Successfully ${overwrite ? 'overwrote' : 'merged'} history! Now containing ${finalHistory.length} total records.` 
    });
  };

  // Upload current certificate as JSON & PDF directly to repo
  const handleUploadCertificateFiles = async () => {
    if (!token || !repo) {
      setActionMessage({ type: 'error', text: 'GitHub configuration is incomplete.' });
      return;
    }

    setIsUploadingCert(true);
    setActionMessage(null);

    try {
      // 1. Get raw logo base64 if possible
      let logoBase64 = '';
      const rawLogoUrl = "https://raw.githubusercontent.com/ParkvanCal/ParkvanCal/main/images/PVC%20Logo.png";
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = rawLogoUrl;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          logoBase64 = canvas.toDataURL('image/png');
        }
      } catch (e) {
        console.warn('Could not convert logo to base64 for backup PDF', e);
      }

      // 2. Generate PDF instance
      const pdfDoc = await generatePDF(currentData, logoBase64);
      
      // Get PDF base64 (without downloading to user disk twice, we just read its output string)
      // pdfDoc.output('datauristring') yields "data:application/pdf;filename=xxx.pdf;base64,xxxx"
      const dataUri = pdfDoc.output('datauristring');
      const pdfBase64 = dataUri.split(',')[1];

      // Clean cert number for file path safety
      const safeCertNo = currentData.certNo.replace(/\s+/g, '_').replace(/-/g, '_');
      const pdfPathInRepo = `certificates/${safeCertNo}.pdf`;
      const jsonPathInRepo = `certificates/${safeCertNo}.json`;

      // 3. Upload JSON file
      const jsonSha = await getFileSha(jsonPathInRepo);
      const jsonBase64 = toBase64(JSON.stringify(currentData, null, 2));
      const jsonRes = await fetch(`https://api.github.com/repos/${repo}/contents/${jsonPathInRepo}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
          message: `Add certificate metadata: ${currentData.certNo}`,
          content: jsonBase64,
          branch: branch,
          ...(jsonSha ? { sha: jsonSha } : {})
        })
      });

      // 4. Upload PDF file
      const pdfSha = await getFileSha(pdfPathInRepo);
      const pdfRes = await fetch(`https://api.github.com/repos/${repo}/contents/${pdfPathInRepo}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
          message: `Add certificate PDF: ${currentData.certNo}`,
          content: pdfBase64,
          branch: branch,
          ...(pdfSha ? { sha: pdfSha } : {})
        })
      });

      if (jsonRes.ok && pdfRes.ok) {
        setActionMessage({
          type: 'success',
          text: `Successfully uploaded Certificate ${currentData.certNo} metadata (.json) and document (.pdf) to folder "/certificates"!`
        });
      } else {
        setActionMessage({
          type: 'error',
          text: 'Uploaded partially or failed. Ensure write permissions on target paths.'
        });
      }

    } catch (e) {
      setActionMessage({ type: 'error', text: 'Network or rendering error while uploading certificate.' });
    } finally {
      setIsUploadingCert(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-navy/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-navy-mid border-t-4 border-gold rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-lite/50 bg-navy">
          <div className="flex items-center gap-3">
            <Github className="text-gold" size={24} />
            <div>
              <h2 className="text-lg font-bold text-gold-lt uppercase tracking-wider">GitHub Synchronisation</h2>
              <p className="text-xs text-blue-300/60">Backup data, publish certificates, and enable GitHub Pages</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-navy-lite/50 rounded-full text-blue-300 hover:text-white transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 divide-y md:divide-y-0 md:divide-x divide-navy-lite/30 overflow-y-auto max-h-[70vh]">
          
          {/* Left Column: Config Panel */}
          <div className="space-y-6 pr-0 md:pr-4">
            <h3 className="text-xs font-bold text-gold uppercase tracking-widest flex items-center gap-2">
              <Key size={14} /> Repository Settings
            </h3>

            {/* Token */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-blue-300 block flex justify-between">
                <span>Personal Access Token (PAT)</span>
                <span className="text-[8px] text-blue-300/50 lowercase">needs 'repo' scope</span>
              </label>
              <div className="relative">
                <input 
                  type={showToken ? "text" : "password"} 
                  value={token}
                  onChange={e => saveConfig('pv_github_token', e.target.value, setToken)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full bg-navy border border-navy-lite text-white pl-3 pr-10 py-2 rounded focus:outline-none focus:border-gold transition-colors text-sm font-mono"
                />
                <button 
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-2.5 text-blue-300 hover:text-white cursor-pointer"
                >
                  {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Repository */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-blue-300 block">Repository Path</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={repo}
                  onChange={e => saveConfig('pv_github_repo', e.target.value, setRepo)}
                  placeholder="username/repository-name"
                  className="w-full bg-navy border border-navy-lite text-white pl-9 pr-3 py-2 rounded focus:outline-none focus:border-gold transition-colors text-sm"
                />
                <Folder className="absolute left-3 top-2.5 text-blue-300/40" size={16} />
              </div>
            </div>

            {/* Branch & DB Path */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-blue-300 block">Branch Name</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={branch}
                    onChange={e => saveConfig('pv_github_branch', e.target.value, setBranch)}
                    className="w-full bg-navy border border-navy-lite text-white pl-9 pr-3 py-2 rounded focus:outline-none focus:border-gold transition-colors text-sm"
                  />
                  <GitBranch className="absolute left-3 top-2.5 text-blue-300/40" size={16} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-blue-300 block">History Filename</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={dbPath}
                    onChange={e => saveConfig('pv_github_db_path', e.target.value, setDbPath)}
                    className="w-full bg-navy border border-navy-lite text-white pl-9 pr-3 py-2 rounded focus:outline-none focus:border-gold transition-colors text-sm font-mono"
                  />
                  <FileJson className="absolute left-3 top-2.5 text-blue-300/40" size={16} />
                </div>
              </div>
            </div>

            {/* Connection Check Action */}
            <div className="pt-2">
              <button 
                onClick={handleTestConnection}
                disabled={isTesting}
                className="w-full bg-navy hover:bg-navy-lite border border-navy-lite/80 text-blue-300 hover:text-white py-2 text-xs font-bold rounded flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isTesting ? <RefreshCcw size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                Verify Repository Credentials
              </button>

              {testResult && (
                <div className={cn(
                  "mt-3 p-3 rounded text-xs flex gap-2 border leading-normal",
                  testResult.success 
                    ? "bg-green-500/10 border-green-500/30 text-green-300" 
                    : "bg-red-500/10 border-red-500/30 text-red-300"
                )}>
                  {testResult.success ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>

            {/* GitHub Pages Guide */}
            <div className="bg-navy border border-navy-lite/40 p-4 rounded-lg space-y-2">
              <h4 className="text-[10px] uppercase font-bold text-gold flex items-center gap-1">
                <HelpCircle size={12} /> GitHub Pages & Actions Workflow
              </h4>
              <p className="text-[11px] text-blue-300/70 leading-relaxed">
                Our application compiles using relative asset links (<code className="text-gold font-mono">base: './'</code>) and includes a pre-configured GitHub Actions workflow in <code className="text-gold font-mono">.github/workflows/deploy.yml</code>!
              </p>
              <div className="text-[10px] text-blue-300/50 space-y-1 list-decimal pl-3 leading-normal">
                <div>• Push this entire repository to your GitHub repository.</div>
                <div>• Under repository <span className="text-blue-300 font-semibold">Settings &gt; Pages</span>:</div>
                <div className="pl-4 text-blue-300/40">Choose Build and deployment Source: <span className="text-gold font-semibold">"GitHub Actions"</span>.</div>
                <div>• GitHub Actions will automatically compile, package, and host your certificate tool!</div>
                <div>• Any certificates deployed here go straight into your hosted folder.</div>
              </div>
            </div>
          </div>

          {/* Right Column: Actions Panel */}
          <div className="space-y-6 pt-6 md:pt-0 pl-0 md:pl-6 flex flex-col justify-between">
            <div className="space-y-6">
              <h3 className="text-xs font-bold text-gold uppercase tracking-widest flex items-center gap-2">
                <Upload size={14} /> Sync & Backup Operations
              </h3>

              {/* Db Backup Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-navy p-3 border border-navy-lite/30 rounded">
                  <span className="text-[8px] text-blue-300/50 uppercase font-bold block">Local Records</span>
                  <span className="text-xl font-bold text-white">{history.length}</span>
                </div>
                <div className="bg-navy p-3 border border-navy-lite/30 rounded">
                  <span className="text-[8px] text-blue-300/50 uppercase font-bold block">Last Pushed Sync</span>
                  <span className="text-[11px] font-medium text-gold-lt leading-none mt-1 block truncate">
                    {lastSync || 'Never'}
                  </span>
                </div>
              </div>

              {/* Main DB Sync Buttons */}
              <div className="space-y-3">
                <button 
                  onClick={handlePushDatabase}
                  disabled={isPushingDb || isPullingDb || !token || !repo}
                  className="w-full bg-gold hover:bg-gold-lt text-navy py-2.5 text-xs font-bold rounded flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isPushingDb ? <RefreshCcw size={14} className="animate-spin" /> : <Upload size={14} />}
                  Backup Database (Push Local History)
                </button>

                <button 
                  onClick={handlePullDatabase}
                  disabled={isPushingDb || isPullingDb || !token || !repo}
                  className="w-full bg-navy border border-gold/30 hover:border-gold text-gold-lt hover:text-gold py-2.5 text-xs font-bold rounded flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isPullingDb ? <RefreshCcw size={14} className="animate-spin" /> : <Download size={14} />}
                  Restore Database (Pull History)
                </button>
              </div>

              {/* Pull Restore Handling */}
              {pulledData && (
                <div className="bg-navy/80 p-4 border border-gold/20 rounded-lg space-y-3">
                  <h4 className="text-[10px] uppercase font-bold text-gold-lt">Restore Options</h4>
                  <p className="text-[11px] text-blue-300/70">
                    You pulled a database containing <b>{pulledData.length} records</b>. How do you want to apply them?
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => applyRestore(false)}
                      className="bg-navy border border-navy-lite hover:border-blue-300 text-blue-300 hover:text-white py-1.5 text-[10px] font-bold rounded cursor-pointer transition-all"
                    >
                      Merge with Local
                    </button>
                    <button 
                      onClick={() => applyRestore(true)}
                      className="bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-300 py-1.5 text-[10px] font-bold rounded cursor-pointer transition-all"
                    >
                      Overwrite Local
                    </button>
                  </div>
                </div>
              )}

              {/* Active Certificate Sync */}
              <div className="border-t border-navy-lite/30 pt-5 space-y-3">
                <h4 className="text-[10px] font-bold text-gold uppercase tracking-wider flex items-center gap-1.5">
                  <FileText size={12} /> Active Certificate Deployment
                </h4>
                <p className="text-[11px] text-blue-300/60 leading-normal">
                  Upload current active certificate (<code className="text-white font-semibold">{currentData.certNo}</code>) as raw metadata (.json) and styled document (.pdf) directly to the <code className="text-gold font-mono">/certificates</code> folder.
                </p>
                <button 
                  onClick={handleUploadCertificateFiles}
                  disabled={isUploadingCert || !token || !repo}
                  className="w-full border-2 border-dashed border-gold/40 hover:border-gold/80 text-gold-lt py-2 text-xs font-bold rounded flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40"
                >
                  {isUploadingCert ? <RefreshCcw size={14} className="animate-spin" /> : <Upload size={14} />}
                  Deploy Current Certificate JSON & PDF
                </button>
              </div>
            </div>

            {/* Response Banner */}
            <div className="pt-4">
              {actionMessage && (
                <div className={cn(
                  "p-3 rounded text-xs flex gap-2 border leading-normal animate-fadeIn",
                  actionMessage.type === 'success' 
                    ? "bg-green-500/15 border-green-500/30 text-green-300" 
                    : "bg-red-500/15 border-red-500/30 text-red-300"
                )}>
                  {actionMessage.type === 'success' ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
                  <span>{actionMessage.text}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-navy border-t border-navy-lite/50 px-6 py-4 flex justify-between items-center text-[10px] text-blue-300/40">
          <span>Secure: API credentials remain 100% locally on your browser.</span>
          <a 
            href="https://github.com/settings/tokens" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-gold hover:text-gold-lt hover:underline flex items-center gap-1"
          >
            Create GitHub PAT <ExternalLink size={10} />
          </a>
        </div>
      </motion.div>
    </div>
  );
}
