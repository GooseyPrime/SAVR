/**
 * SAVR Scanner Component - Complete Implementation
 * Full-featured vision interface for scanning pantry items
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera,
  X,
  RotateCcw,
  Check,
  Plus,
  Minus,
  Image as ImageIcon,
  AlertCircle,
  Refrigerator,
  Snowflake,
  Package,
  Scan,
  Trash2,
  Edit3,
  Calendar,
  CheckSquare,
  Square,
  Barcode,
  Sparkles } from
'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useImageAnalysis, useBarcodeLookup, fileToBase64 } from '@/hooks/use-savr-api';
import { useAppStore } from '@/store/app-store';

interface AnalyzedItem {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  confidence: number;
  selected: boolean;
  expirationDate?: string;
}

interface ScannerProps {
  isOpen: boolean;
  onClose: () => void;
}

const locationOptions = [
{ id: 'refrigerator' as const, label: 'Refrigerator', icon: Refrigerator },
{ id: 'freezer' as const, label: 'Freezer', icon: Snowflake },
{ id: 'pantry' as const, label: 'Pantry', icon: Package }];


const categoryOptions = [
'produce',
'dairy',
'meat',
'seafood',
'grains',
'canned',
'frozen',
'snacks',
'beverages',
'condiments',
'spices',
'other'];


export function Scanner({ isOpen, onClose }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [location, setLocation] = useState<'refrigerator' | 'freezer' | 'pantry'>('pantry');
  const [items, setItems] = useState<AnalyzedItem[]>([]);
  const [step, setStep] = useState<'camera' | 'review'>('camera');
  const [scanMode, setScanMode] = useState<'ai' | 'barcode'>('ai');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');

  const { analyzeImage, isAnalyzing, error: analysisError, clearError } = useImageAnalysis();
  const { lookupBarcode, isLooking: isLookingBarcode, error: barcodeError, clearError: clearBarcodeError } = useBarcodeLookup();
  const { addInventoryItem } = useAppStore();

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError('Camera access unavailable. Please upload a photo.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    if (isOpen && step === 'camera' && !capturedImage) {
      startCamera();
    }
    return () => {
      if (!isOpen) {
        stopCamera();
      }
    };
  }, [isOpen, step, capturedImage, startCamera, stopCamera]);

  const processAnalysisResult = useCallback((
  result: {items: {name: string;quantity?: number;unit?: string;category: string;confidence: number;}[];} | null) =>
  {
    if (result?.items) {
      setItems(
        result.items.map((item) => ({
          name: item.name,
          quantity: item.quantity || 1,
          unit: item.unit || 'item',
          category: item.category,
          confidence: item.confidence,
          selected: true
        }))
      );
      setStep('review');
    }
  }, []);

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(imageData);
    stopCamera();

    const base64 = imageData.split(',')[1];
    const result = await analyzeImage(base64, location);
    processAnalysisResult(result);
  }, [analyzeImage, location, stopCamera, processAnalysisResult]);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const base64 = await fileToBase64(file);
      const imageData = `data:${file.type};base64,${base64}`;
      setCapturedImage(imageData);
      stopCamera();

      const result = await analyzeImage(base64, location);
      processAnalysisResult(result);
    },
    [analyzeImage, location, stopCamera, processAnalysisResult]
  );

  const retryAnalysis = useCallback(async () => {
    if (!capturedImage) return;
    clearError();
    const base64 = capturedImage.split(',')[1];
    const result = await analyzeImage(base64, location);
    processAnalysisResult(result);
  }, [capturedImage, analyzeImage, location, clearError, processAnalysisResult]);

  const toggleItem = useCallback((index: number) => {
    setItems((prev) =>
    prev.map((item, i) => i === index ? { ...item, selected: !item.selected } : item)
    );
  }, []);

  const selectAll = useCallback(() => {
    setItems((prev) => prev.map((item) => ({ ...item, selected: true })));
  }, []);

  const deselectAll = useCallback(() => {
    setItems((prev) => prev.map((item) => ({ ...item, selected: false })));
  }, []);

  const updateQuantity = useCallback((index: number, delta: number) => {
    setItems((prev) =>
    prev.map((item, i) =>
    i === index ? { ...item, quantity: Math.max(0, (item.quantity || 1) + delta) } : item
    )
    );
  }, []);

  const updateItemName = useCallback((index: number, name: string) => {
    setItems((prev) =>
    prev.map((item, i) => i === index ? { ...item, name } : item)
    );
  }, []);

  const updateItemCategory = useCallback((index: number, category: string) => {
    setItems((prev) =>
    prev.map((item, i) => i === index ? { ...item, category } : item)
    );
  }, []);

  const updateItemExpiration = useCallback((index: number, date: string) => {
    setItems((prev) =>
    prev.map((item, i) => i === index ? { ...item, expirationDate: date } : item)
    );
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setEditingIndex(null);
  }, []);

  const addNewItem = useCallback(() => {
    if (!newItemName.trim()) return;
    setItems((prev) => [
    ...prev,
    {
      name: newItemName.trim(),
      quantity: 1,
      unit: 'item',
      category: 'other',
      confidence: 1,
      selected: true
    }]
    );
    setNewItemName('');
    setShowAddItem(false);
  }, [newItemName]);

  const handleClose = useCallback(() => {
    stopCamera();
    setCapturedImage(null);
    setItems([]);
    setStep('camera');
    setEditingIndex(null);
    setShowAddItem(false);
    onClose();
  }, [stopCamera, onClose]);

  const addToInventory = useCallback(() => {
    const selectedItems = items.filter((item) => item.selected);
    selectedItems.forEach((item) => {
      addInventoryItem({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category,
        location: location,
        expirationDate: item.expirationDate
      });
    });
    handleClose();
  }, [items, addInventoryItem, handleClose, location]);

  const resetScanner = useCallback(() => {
    setCapturedImage(null);
    setItems([]);
    setStep('camera');
    setEditingIndex(null);
    setBarcodeInput('');
    startCamera();
  }, [startCamera]);

  const handleBarcodeLookup = useCallback(async () => {
    if (!barcodeInput.trim()) return;
    clearBarcodeError();

    const result = await lookupBarcode(barcodeInput.trim());
    if (result?.found && result.product) {
      const product = result.product;
      setItems([{
        name: product.name,
        quantity: 1,
        unit: product.quantity || 'item',
        category: product.category || 'other',
        confidence: 1,
        selected: true
      }]);
      setStep('review');
    } else {
      // Product not found - allow manual entry
      setItems([{
        name: `Product (${barcodeInput})`,
        quantity: 1,
        unit: 'item',
        category: 'other',
        confidence: 0.5,
        selected: true
      }]);
      setStep('review');
    }
  }, [barcodeInput, lookupBarcode, clearBarcodeError]);

  if (!isOpen) return null;

  const selectedCount = items.filter((i) => i.selected).length;
  const allSelected = items.length > 0 && items.every((i) => i.selected);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background">

        <canvas data-ev-id="ev_7c9fa48a1f" ref={canvasRef} className="hidden" />
        <input data-ev-id="ev_37bf7f0599"
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload} />


        {step === 'camera' &&
        <>
            <div data-ev-id="ev_eaf108d67b" className="relative h-full">
              {cameraError ?
            <div data-ev-id="ev_a2f57b0d89" className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <AlertCircle className="w-16 h-16 text-foreground-muted mb-4" strokeWidth={1} />
                  <p data-ev-id="ev_8393fdb50b" className="text-foreground-secondary mb-6 font-light">{cameraError}</p>
                  <Button onClick={() => fileInputRef.current?.click()}>
                    <ImageIcon className="w-4 h-4" />
                    Upload Photo
                  </Button>
                </div> :

            <>
                  <video data-ev-id="ev_ade29d108a"
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover" />


                  {capturedImage &&
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0">

                      <img data-ev-id="ev_34717c130c" src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
                    </motion.div>
              }

                  {isAnalyzing &&
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-background/95 flex flex-col items-center justify-center">

                      <div data-ev-id="ev_b6fd916a8b" className="w-20 h-20 border border-primary/30 flex items-center justify-center mb-6">
                        <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="w-8 h-8 border border-primary border-t-transparent rounded-full" />

                      </div>
                      <p data-ev-id="ev_1c3723815e" className="text-foreground font-display text-lg font-light">Analyzing</p>
                      <p data-ev-id="ev_acb4307b4c" className="text-foreground-muted text-xs font-mono tracking-wider mt-2">
                        AI Vision Processing
                      </p>
                    </motion.div>
              }

                  {/* Scan frame */}
                  {!capturedImage && !isAnalyzing &&
              <div data-ev-id="ev_b50fdb46df" className="absolute inset-12 border border-primary/30 pointer-events-none">
                      <div data-ev-id="ev_6a44ea9b46" className="absolute -top-px -left-px w-6 h-px bg-primary" />
                      <div data-ev-id="ev_647bf1a2c5" className="absolute -top-px -left-px w-px h-6 bg-primary" />
                      <div data-ev-id="ev_deb783f652" className="absolute -top-px -right-px w-6 h-px bg-primary" />
                      <div data-ev-id="ev_ab25d22527" className="absolute -top-px -right-px w-px h-6 bg-primary" />
                      <div data-ev-id="ev_60acef64aa" className="absolute -bottom-px -left-px w-6 h-px bg-primary" />
                      <div data-ev-id="ev_9de08fedc3" className="absolute -bottom-px -left-px w-px h-6 bg-primary" />
                      <div data-ev-id="ev_7891fcb127" className="absolute -bottom-px -right-px w-6 h-px bg-primary" />
                      <div data-ev-id="ev_4161e855d0" className="absolute -bottom-px -right-px w-px h-6 bg-primary" />
                      
                      <motion.div
                  animate={{ y: ['0%', '100%', '0%'] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

                    </div>
              }
                </>
            }
            </div>

            {/* Controls */}
            <div data-ev-id="ev_65454a46d8" className="absolute bottom-0 left-0 right-0 pb-safe bg-gradient-to-t from-background via-background/90 to-transparent">
              {/* Location selector */}
              <div data-ev-id="ev_d3883eb114" className="flex justify-center gap-3 mb-6 px-5">
                {locationOptions.map(({ id, label, icon: Icon }) =>
              <button data-ev-id="ev_5d54968582"
              key={id}
              onClick={() => setLocation(id)}
              className={`
                      flex items-center gap-2 px-4 py-2.5 border
                      text-xs tracking-wider transition-all duration-300 min-h-[44px]
                      ${location === id ?
              'bg-primary/10 border-primary text-primary' :
              'bg-surface border-border text-foreground-secondary hover:border-primary/30'}
                    `
              }
              aria-pressed={location === id}>

                    <Icon className="w-4 h-4" strokeWidth={1.5} />
                    {label}
                  </button>
              )}
              </div>

              {/* Action buttons */}
              <div data-ev-id="ev_4a128d1bfe" className="flex items-center justify-between px-8 py-6">
                <button data-ev-id="ev_361b69332c"
              onClick={handleClose}
              className="w-14 h-14 border border-border flex items-center justify-center text-foreground-muted hover:border-foreground-secondary hover:text-foreground transition-all duration-300"
              aria-label="Close scanner">

                  <X className="w-6 h-6" strokeWidth={1.5} />
                </button>

                <button data-ev-id="ev_bb16aa744a"
              onClick={capturePhoto}
              disabled={isAnalyzing || !!cameraError}
              className="w-20 h-20 border-2 border-primary flex items-center justify-center disabled:opacity-30 hover:bg-primary/10 transition-all duration-300"
              aria-label="Capture photo">

                  <Scan className="w-8 h-8 text-primary" strokeWidth={1.5} />
                </button>

                <button data-ev-id="ev_23b696bdc9"
              onClick={() => fileInputRef.current?.click()}
              className="w-14 h-14 border border-border flex items-center justify-center text-foreground-muted hover:border-foreground-secondary hover:text-foreground transition-all duration-300"
              aria-label="Upload photo">

                  <ImageIcon className="w-6 h-6" strokeWidth={1.5} />
                </button>
              </div>
            </div>

            {/* Header with Mode Toggle */}
            <div data-ev-id="ev_22d1b88126" className="absolute top-0 left-0 right-0 pt-safe">
              <div data-ev-id="ev_29ffa386f7" className="flex flex-col items-center gap-3 p-5">
                <div data-ev-id="ev_7b0cccc1d5" className="flex items-center gap-2 bg-surface/90 backdrop-blur-xl border border-border p-1">
                  <button data-ev-id="ev_d054b1c116"
                onClick={() => setScanMode('ai')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-mono tracking-wider uppercase transition-all min-h-[44px] ${
                scanMode === 'ai' ? 'bg-primary/20 text-primary' : 'text-foreground-muted hover:text-foreground'}`
                }>

                    <Sparkles className="w-4 h-4" strokeWidth={1.5} />
                    AI Scan
                  </button>
                  <button data-ev-id="ev_dfd0689d7e"
                onClick={() => setScanMode('barcode')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-mono tracking-wider uppercase transition-all min-h-[44px] ${
                scanMode === 'barcode' ? 'bg-primary/20 text-primary' : 'text-foreground-muted hover:text-foreground'}`
                }>

                    <Barcode className="w-4 h-4" strokeWidth={1.5} />
                    Barcode
                  </button>
                </div>
                
                {/* Barcode Input (when in barcode mode) */}
                {scanMode === 'barcode' &&
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-xs bg-surface/95 backdrop-blur-xl border border-border p-4">

                    <p data-ev-id="ev_6d0fc35aaa" className="text-xs text-foreground-muted mb-2 text-center">Enter or scan barcode</p>
                    <div data-ev-id="ev_afe1570b5e" className="flex gap-2">
                      <Input
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder="Barcode number..."
                    className="flex-1 font-mono text-center"
                    onKeyDown={(e) => e.key === 'Enter' && handleBarcodeLookup()} />

                      <Button
                    onClick={handleBarcodeLookup}
                    disabled={isLookingBarcode || !barcodeInput.trim()}
                    size="sm">

                        {isLookingBarcode ?
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full" /> :


                    <Check className="w-4 h-4" />
                    }
                      </Button>
                    </div>
                    {barcodeError &&
                <p data-ev-id="ev_dfd78a4b57" className="text-xs text-danger mt-2 text-center">{barcodeError}</p>
                }
                  </motion.div>
              }
              </div>
            </div>
          </>
        }

        {step === 'review' &&
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          className="h-full flex flex-col bg-background">

            {/* Header */}
            <div data-ev-id="ev_5e1eb69f9e" className="pt-safe">
              <div data-ev-id="ev_ba231ff1ea" className="flex items-center justify-between p-5 border-b border-border">
                <button data-ev-id="ev_94a7241fbb"
              onClick={resetScanner}
              className="p-2 text-foreground-muted hover:text-foreground transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Retake photo">

                  <RotateCcw className="w-5 h-5" strokeWidth={1.5} />
                </button>
                <div data-ev-id="ev_0b4be1158d" className="text-center">
                  <h2 data-ev-id="ev_2f3166755f" className="font-display text-lg font-light text-foreground">Review Items</h2>
                  <p data-ev-id="ev_8e1f26c855" className="text-[10px] text-foreground-muted font-mono tracking-wider">
                    {items.length} Detected
                  </p>
                </div>
                <button data-ev-id="ev_1d13a6c726"
              onClick={handleClose}
              className="p-2 text-foreground-muted hover:text-foreground transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Close">

                  <X className="w-5 h-5" strokeWidth={1.5} />
                </button>
              </div>
            </div>

            {/* Thumbnail & Storage */}
            {capturedImage &&
          <div data-ev-id="ev_c1cf1615ef" className="p-4 border-b border-border">
                <div data-ev-id="ev_5ec0e37114" className="flex gap-4">
                  <img data-ev-id="ev_cf9fdd5a4f"
              src={capturedImage}
              alt="Scanned items"
              className="w-20 h-20 object-cover border border-border flex-shrink-0" />

                  <div data-ev-id="ev_ff1d0fc652" className="flex-1">
                    <p data-ev-id="ev_86e7cf6355" className="text-xs text-foreground-muted mb-2 font-mono">Storage Location</p>
                    <div data-ev-id="ev_606159ab9f" className="flex flex-wrap gap-2">
                      {locationOptions.map(({ id, label, icon: Icon }) =>
                  <button data-ev-id="ev_47770154ad"
                  key={id}
                  onClick={() => setLocation(id)}
                  className={`
                            flex items-center gap-1.5 px-3 py-1.5 border text-xs
                            ${location === id ?
                  'bg-primary/10 border-primary text-primary' :
                  'border-border text-foreground-muted hover:border-primary/30'}
                          `
                  }>

                          <Icon className="w-3 h-3" />
                          {label}
                        </button>
                  )}
                    </div>
                  </div>
                </div>
              </div>
          }

            {/* Selection controls */}
            <div data-ev-id="ev_18765116a7" className="flex items-center justify-between px-5 py-3 border-b border-border">
              <button data-ev-id="ev_1bfb622920"
            onClick={allSelected ? deselectAll : selectAll}
            className="flex items-center gap-2 text-sm text-foreground-secondary hover:text-foreground transition-colors min-h-[44px]">

                {allSelected ?
              <CheckSquare className="w-4 h-4 text-primary" /> :

              <Square className="w-4 h-4" />
              }
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
              
              <div data-ev-id="ev_990e207faf" className="flex items-center gap-2">
                {analysisError &&
              <Button size="sm" variant="outline" onClick={retryAnalysis}>
                    <RotateCcw className="w-3 h-3" />
                    Retry
                  </Button>
              }
                <Button size="sm" variant="outline" onClick={() => setShowAddItem(true)}>
                  <Plus className="w-3 h-3" />
                  Add Item
                </Button>
              </div>
            </div>

            {/* Add item form */}
            {showAddItem &&
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-5 py-3 border-b border-border bg-surface">

                <div data-ev-id="ev_b199f5783b" className="flex gap-2">
                  <Input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Item name..."
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && addNewItem()}
                autoFocus />

                  <Button onClick={addNewItem} disabled={!newItemName.trim()}>
                    Add
                  </Button>
                  <Button variant="ghost" onClick={() => setShowAddItem(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
          }

            {/* Items list */}
            <div data-ev-id="ev_77340fea7e" className="flex-1 overflow-y-auto px-5 py-4">
              <div data-ev-id="ev_0cfdf11405" className="flex flex-col gap-3">
                {items.map((item, index) =>
              <Card
                key={index}
                variant="interactive"
                padding="sm"
                className={`transition-all duration-300 ${!item.selected && 'opacity-40'}`}>

                    {editingIndex === index ?
                // Edit mode
                <div data-ev-id="ev_81d51de895" className="flex flex-col gap-3">
                        <Input
                    value={item.name}
                    onChange={(e) => updateItemName(index, e.target.value)}
                    placeholder="Item name"
                    autoFocus />

                        <div data-ev-id="ev_9f6816cc65" className="flex gap-2">
                          <select data-ev-id="ev_e2a5a1635b"
                    value={item.category}
                    onChange={(e) => updateItemCategory(index, e.target.value)}
                    className="flex-1 bg-surface border border-border rounded-[var(--radius-md)] px-3 py-2 text-sm text-foreground">

                            {categoryOptions.map((cat) =>
                      <option data-ev-id="ev_7c4508e58c" key={cat} value={cat}>
                                {cat.charAt(0).toUpperCase() + cat.slice(1)}
                              </option>
                      )}
                          </select>
                          <Input
                      type="date"
                      value={item.expirationDate || ''}
                      onChange={(e) => updateItemExpiration(index, e.target.value)}
                      className="flex-1"
                      placeholder="Expiration" />

                        </div>
                        <div data-ev-id="ev_47fdb92cd4" className="flex justify-between">
                          <Button
                      size="sm"
                      variant="danger"
                      onClick={() => removeItem(index)}>

                            <Trash2 className="w-3 h-3" />
                            Remove
                          </Button>
                          <Button size="sm" onClick={() => setEditingIndex(null)}>
                            <Check className="w-3 h-3" />
                            Done
                          </Button>
                        </div>
                      </div> :

                // Display mode
                <div data-ev-id="ev_254656c4bc" className="flex items-center gap-4">
                        <button data-ev-id="ev_db68f3bc6b"
                  onClick={() => toggleItem(index)}
                  className={`
                            w-6 h-6 border flex items-center justify-center
                            transition-all duration-300 flex-shrink-0
                            ${item.selected ?
                  'bg-primary border-primary text-primary-foreground' :
                  'border-border hover:border-foreground-secondary'}
                          `
                  }
                  aria-label={item.selected ? 'Deselect item' : 'Select item'}>

                          {item.selected && <Check className="w-4 h-4" />}
                        </button>

                        <div data-ev-id="ev_57999bb830" className="flex-1 min-w-0">
                          <p data-ev-id="ev_65f12e263c" className="font-light text-foreground truncate">{item.name}</p>
                          <div data-ev-id="ev_58728674a3" className="flex items-center gap-2 text-xs text-foreground-muted font-mono tracking-wider">
                            <span data-ev-id="ev_dace2b58bd" className="capitalize">{item.category}</span>
                            <span data-ev-id="ev_6cc282fa3a" className="opacity-30">•</span>
                            <span data-ev-id="ev_9e426375f3" className={item.confidence > 0.8 ? 'text-primary' : 'text-warning'}>
                              {Math.round(item.confidence * 100)}%
                            </span>
                            {item.expirationDate &&
                      <>
                                <span data-ev-id="ev_5aaacb0006" className="opacity-30">•</span>
                                <span data-ev-id="ev_ebb0dacdb9" className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(item.expirationDate).toLocaleDateString()}
                                </span>
                              </>
                      }
                          </div>
                        </div>

                        <button data-ev-id="ev_624ef93bb6"
                  onClick={() => setEditingIndex(index)}
                  className="w-8 h-8 flex items-center justify-center text-foreground-muted hover:text-foreground transition-colors"
                  aria-label="Edit item">

                          <Edit3 className="w-4 h-4" />
                        </button>

                        <div data-ev-id="ev_b399aa037e" className="flex items-center gap-2">
                          <button data-ev-id="ev_3a1af6d221"
                    onClick={() => updateQuantity(index, -1)}
                    className="w-8 h-8 border border-border flex items-center justify-center hover:border-foreground-secondary transition-colors"
                    aria-label="Decrease quantity">

                            <Minus className="w-4 h-4" strokeWidth={1.5} />
                          </button>
                          <span data-ev-id="ev_b752950d4d" className="w-8 text-center font-mono text-sm">
                            {item.quantity}
                          </span>
                          <button data-ev-id="ev_81e9116532"
                    onClick={() => updateQuantity(index, 1)}
                    className="w-8 h-8 border border-border flex items-center justify-center hover:border-foreground-secondary transition-colors"
                    aria-label="Increase quantity">

                            <Plus className="w-4 h-4" strokeWidth={1.5} />
                          </button>
                        </div>
                      </div>
                }
                  </Card>
              )}
              </div>

              {items.length === 0 &&
            <div data-ev-id="ev_a551c1ede6" className="flex flex-col items-center justify-center py-12 text-center">
                  <Package className="w-12 h-12 text-foreground-muted mb-4" strokeWidth={1} />
                  <p data-ev-id="ev_d73791bd15" className="text-foreground-secondary mb-4">No items detected</p>
                  <Button onClick={() => setShowAddItem(true)}>
                    <Plus className="w-4 h-4" />
                    Add Item Manually
                  </Button>
                </div>
            }

              {analysisError &&
            <div data-ev-id="ev_887028d538" className="mt-4 p-4 bg-error/5 border border-error/20 rounded-[var(--radius-md)]">
                  <p data-ev-id="ev_53194c2d66" className="text-error text-sm font-light">{analysisError}</p>
                  <Button
                size="sm"
                variant="outline"
                onClick={retryAnalysis}
                className="mt-3">

                    <RotateCcw className="w-3 h-3" />
                    Retry Analysis
                  </Button>
                </div>
            }
            </div>

            {/* Footer */}
            <div data-ev-id="ev_d7bd7b6137" className="pb-safe border-t border-border">
              <div data-ev-id="ev_3f01a94452" className="p-5">
                <Button
                fullWidth
                size="lg"
                onClick={addToInventory}
                disabled={selectedCount === 0}>

                  <Plus className="w-5 h-5" />
                  Add {selectedCount} Item{selectedCount !== 1 ? 's' : ''} to {location.charAt(0).toUpperCase() + location.slice(1)}
                </Button>
              </div>
            </div>
          </motion.div>
        }
      </motion.div>
    </AnimatePresence>);

}