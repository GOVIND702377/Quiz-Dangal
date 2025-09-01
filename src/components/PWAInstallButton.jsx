import React, { useState, useEffect } from 'react';
import { Download, Share, Plus, X } from 'lucide-react';

const PWAInstallButton = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebAppiOS = window.navigator.standalone === true;
    const isAppInstalled = isStandalone || isInWebAppiOS;

    if (isAppInstalled) {
      setShowInstallButton(false);
      return;
    }

    // Show button by default for testing
    setShowInstallButton(true);

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setShowInstallButton(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    // First try automatic install if available
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          setDeferredPrompt(null);
          setShowInstallButton(false);
          return;
        }
      } catch (error) {
        console.log('Install prompt failed:', error);
      }
    }

    // If automatic install not available, show manual instructions
    setShowIOSModal(true);
  };

  if (!showInstallButton) {
    return null;
  }

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="w-14 h-14 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center group relative overflow-hidden"
        style={{
          position: 'fixed',
          bottom: '100px',
          right: '20px',
          zIndex: 9999
        }}
        aria-label="Download App"
      >
        {/* Fire Animation Background */}
        <div className="absolute inset-0 bg-gradient-to-t from-red-600 via-orange-500 to-yellow-400 opacity-30 animate-pulse"></div>
        
        {/* Fire Particles */}
        <div className="absolute inset-0">
          <div className="absolute top-2 left-3 w-1 h-1 bg-yellow-300 rounded-full animate-bounce" style={{animationDelay: '0s', animationDuration: '1s'}}></div>
          <div className="absolute top-3 right-2 w-1 h-1 bg-orange-300 rounded-full animate-bounce" style={{animationDelay: '0.3s', animationDuration: '1.2s'}}></div>
          <div className="absolute bottom-3 left-2 w-1 h-1 bg-red-300 rounded-full animate-bounce" style={{animationDelay: '0.6s', animationDuration: '0.8s'}}></div>
        </div>
        
        <Download className="w-5 h-5 relative z-10" />
        
        <span className="hidden group-hover:block absolute right-16 bg-gray-900 text-white px-2 py-1 rounded text-xs whitespace-nowrap">
          Download App
        </span>
      </button>

      {/* iOS Install Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full relative">
            <button
              onClick={() => setShowIOSModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Download className="w-8 h-8 text-white" />
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Quiz Dangal Install करें 🔥
              </h3>
              
              <p className="text-gray-600 text-sm mb-6">
                इस app को अपने phone में install करने के लिए:
              </p>
              
              <div className="space-y-3 text-left">
                {(() => {
                  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                  const isChrome = /Chrome/.test(navigator.userAgent);
                  const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
                  
                  if (isIOS) {
                    return (
                      <>
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-semibold text-sm">1</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Share className="w-5 h-5 text-blue-600" />
                            <span className="text-sm text-gray-700">Share button दबाएं</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-semibold text-sm">2</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Plus className="w-5 h-5 text-blue-600" />
                            <span className="text-sm text-gray-700">"Add to Home Screen" चुनें</span>
                          </div>
                        </div>
                      </>
                    );
                  } else if (isChrome) {
                    return (
                      <>
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-semibold text-sm">1</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">⋮</span>
                            <span className="text-sm text-gray-700">Chrome Menu (3 dots) दबाएं</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-semibold text-sm">2</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Plus className="w-5 h-5 text-blue-600" />
                            <span className="text-sm text-gray-700">"Add to Home Screen" या "Install App" चुनें</span>
                          </div>
                        </div>
                      </>
                    );
                  } else {
                    return (
                      <>
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-semibold text-sm">1</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">⋮</span>
                            <span className="text-sm text-gray-700">Browser Menu दबाएं</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-semibold text-sm">2</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Plus className="w-5 h-5 text-blue-600" />
                            <span className="text-sm text-gray-700">"Add to Home Screen" चुनें</span>
                          </div>
                        </div>
                      </>
                    );
                  }
                })()}
              </div>
              
              <button
                onClick={() => setShowIOSModal(false)}
                className="mt-6 w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-medium"
              >
                समझ गया
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PWAInstallButton;