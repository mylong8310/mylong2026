(() => {
  const disabled = () => Promise.reject(new Error('API_DISABLED_OFFLINE_FIRST'));
  window.FitApi = Object.freeze({
    enabled: false,
    baseUrl: '',
    syncContent: disabled,
    syncRules: disabled,
    backupLocalData: disabled,
    analyzeFoodPhoto: disabled,
    analyzeHealthTrend: disabled
  });
})();
