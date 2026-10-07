package com.fitbalance.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.SystemClock;
import android.provider.MediaStore;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends Activity implements SensorEventListener {
    private static final int REQ_ACTIVITY = 41;
    private static final int REQ_FILE = 42;

    private WebView webView;
    private SensorManager sensorManager;
    private Sensor stepSensor;
    private float currentCounter = -1f;
    private boolean sensorRegistered = false;
    private SharedPreferences prefs;
    private FitDatabase database;
    private ValueCallback<Uri[]> filePathCallback;
    private Uri cameraUri;

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.rgb(9, 14, 11));
        getWindow().setNavigationBarColor(Color.rgb(9, 14, 11));
        getWindow().getDecorView().setSystemUiVisibility(0);

        prefs = getSharedPreferences("fitbalance_native", MODE_PRIVATE);
        database = new FitDatabase(
                this,
                BuildConfig.VERSION_NAME,
                BuildConfig.VERSION_CODE,
                BuildConfig.GIT_SHA,
                BuildConfig.RULE_VERSION,
                BuildConfig.CONTENT_VERSION,
                BuildConfig.EVIDENCE_VERSION);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(9, 14, 11));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setInitialScale(100);
        webView.setLongClickable(false);
        webView.setOnLongClickListener(v -> true);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setTextZoom(100);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        webView.addJavascriptInterface(new FitBridge(), "FitBridge");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("tel".equalsIgnoreCase(uri.getScheme())) {
                    openDialer(uri.getSchemeSpecificPart());
                    return true;
                }
                return false;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView view,
                    ValueCallback<Uri[]> callback,
                    FileChooserParams params) {

                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;

                Intent contentIntent = new Intent(Intent.ACTION_GET_CONTENT);
                contentIntent.addCategory(Intent.CATEGORY_OPENABLE);
                contentIntent.setType("image/*");

                Intent cameraIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                try {
                    File photo = createImageFile();
                    cameraUri = FileProvider.getUriForFile(
                            MainActivity.this,
                            getPackageName() + ".fileprovider",
                            photo);
                    cameraIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
                    cameraIntent.addFlags(
                            Intent.FLAG_GRANT_WRITE_URI_PERMISSION |
                            Intent.FLAG_GRANT_READ_URI_PERMISSION);
                } catch (IOException e) {
                    cameraIntent = null;
                    cameraUri = null;
                }

                Intent chooser = new Intent(Intent.ACTION_CHOOSER);
                chooser.putExtra(Intent.EXTRA_INTENT, contentIntent);
                chooser.putExtra(Intent.EXTRA_TITLE, "拍照或选择食物图片");
                if (cameraIntent != null) {
                    chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cameraIntent});
                }

                startActivityForResult(chooser, REQ_FILE);
                return true;
            }
        });

        sensorManager = (SensorManager) getSystemService(SENSOR_SERVICE);
        if (sensorManager != null) {
            stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        }

        if (savedInstanceState == null) {
            webView.loadUrl("file:///android_asset/index.html");
        } else {
            webView.restoreState(savedInstanceState);
        }

        ensureActivityPermission();
    }

    private void openDialer(String rawPhone) {
        if (rawPhone == null) return;
        String phone = rawPhone.replaceAll("[^0-9+]", "");
        if (phone.isEmpty()) return;
        try {
            Intent intent = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + phone));
            startActivity(intent);
        } catch (Exception ignored) {
        }
    }

    private File createImageFile() throws IOException {
        File dir = getExternalFilesDir(Environment.DIRECTORY_PICTURES);
        if (dir == null) dir = getCacheDir();
        return File.createTempFile("fitmeal_", ".jpg", dir);
    }

    private String todayKey() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    private void ensureActivityPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
                checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.ACTIVITY_RECOGNITION}, REQ_ACTIVITY);
        } else {
            registerStepSensor();
        }
    }

    private void registerStepSensor() {
        if (stepSensor != null && !sensorRegistered) {
            sensorRegistered = sensorManager.registerListener(
                    this, stepSensor, SensorManager.SENSOR_DELAY_NORMAL);
        }
    }

    private String currentBootId() {
        long bootEpochMinute = (System.currentTimeMillis() - SystemClock.elapsedRealtime()) / 60000L;
        return String.valueOf(bootEpochMinute);
    }

    private int processStepCounter(float rawCounter) {
        String today = todayKey();
        String bootId = currentBootId();

        String lastDate = prefs.getString("step_ledger_date", "");
        String lastBoot = prefs.getString("step_ledger_boot", "");
        float lastRaw = prefs.getFloat("step_ledger_raw", -1f);
        int storedToday = prefs.getInt("step_ledger_today", 0);
        String confidence = "sensor_delta";

        int todaySteps;
        if (lastRaw < 0) {
            todaySteps = today.equals(lastDate) ? Math.max(0, storedToday) : 0;
            confidence = "first_baseline";
        } else if (bootId.equals(lastBoot) && rawCounter >= lastRaw) {
            int delta = Math.max(0, Math.round(rawCounter - lastRaw));
            if (today.equals(lastDate)) {
                todaySteps = Math.max(0, storedToday + delta);
                confidence = "sensor_delta";
            } else {
                // The cumulative sensor keeps counting while the app is closed.
                // Without a midnight sample we cannot split the delta exactly,
                // so assign the cross-day delta to today and mark it explicitly.
                todaySteps = delta;
                confidence = "cross_day_estimate";
            }
        } else {
            // TYPE_STEP_COUNTER resets after reboot. The new raw value is
            // the steps since this boot; preserve today's existing ledger.
            int sinceBoot = Math.max(0, Math.round(rawCounter));
            if (today.equals(lastDate)) {
                todaySteps = Math.max(0, storedToday + sinceBoot);
                confidence = "reboot_estimate";
            } else {
                todaySteps = sinceBoot;
                confidence = "reboot_cross_day_estimate";
            }
        }

        prefs.edit()
                .putString("step_ledger_date", today)
                .putString("step_ledger_boot", bootId)
                .putFloat("step_ledger_raw", rawCounter)
                .putInt("step_ledger_today", todaySteps)
                .putString("step_ledger_confidence", confidence)
                .putLong("step_ledger_updated_at", System.currentTimeMillis())
                .apply();

        if (database != null) {
            database.upsertDailySteps(today, todaySteps, "TYPE_STEP_COUNTER", confidence, rawCounter, bootId);
        }
        return todaySteps;
    }

    private int getTodayStepsInternal() {
        if (stepSensor == null) return -1;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
                checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION) != PackageManager.PERMISSION_GRANTED) {
            return -2;
        }

        if (currentCounter >= 0) {
            return processStepCounter(currentCounter);
        }

        String today = todayKey();
        String storedDate = prefs.getString("step_ledger_date", "");
        if (today.equals(storedDate)) {
            return Math.max(0, prefs.getInt("step_ledger_today", 0));
        }
        return 0;
    }

    private void pushStepsToWeb(int steps) {
        if (webView == null) return;
        String confidence = prefs.getString("step_ledger_confidence", "waiting");
        String js = "window.FitNative && window.FitNative.receiveAndroidSteps(" +
                steps + ", 'TYPE_STEP_COUNTER', '" + confidence.replace("'", "") + "');";
        webView.post(() -> webView.evaluateJavascript(js, null));
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_STEP_COUNTER && event.values.length > 0) {
            currentCounter = event.values[0];
            int steps = processStepCounter(currentCounter);
            pushStepsToWeb(steps);
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}

    public class FitBridge {
        @JavascriptInterface
        public int getTodaySteps() {
            return getTodayStepsInternal();
        }

        @JavascriptInterface
        public boolean isStepCounterAvailable() {
            return stepSensor != null;
        }

        @JavascriptInterface
        public void requestStepPermission() {
            runOnUiThread(() -> ensureActivityPermission());
        }

        @JavascriptInterface
        public void dialNumber(String phone) {
            runOnUiThread(() -> openDialer(phone));
        }

        @JavascriptInterface
        public String getZhuangziStatusJson() {
            return database != null ? database.getZhuangziStatusJson() : "{}";
        }

        @JavascriptInterface
        public String getZhuangziDayJson(int dayNo) {
            return database != null ? database.getZhuangziDayJson(dayNo) : "{}";
        }

        @JavascriptInterface
        public boolean setZhuangziCheckin(int dayNo, boolean checked) {
            return database != null && database.setZhuangziCheckin(dayNo, checked);
        }

        @JavascriptInterface
        public String evaluateFoodRiskJson(String foodId, String profileJson) {
            return database != null
                    ? database.evaluateFoodRiskJson(foodId, profileJson)
                    : "{\"status\":\"neutral\",\"items\":[]}";
        }

        @JavascriptInterface
        public String getFoodCatalogJson() {
            return database != null ? database.getFoodCatalogJson() : "[]";
        }

        @JavascriptInterface
        public String getStepHistoryJson(int days) {
            return database != null ? database.getStepHistoryJson(days) : "[]";
        }

        @JavascriptInterface
        public boolean upsertDailyMetricsJson(String json) {
            return database != null && database.upsertDailyMetricsJson(json);
        }

        @JavascriptInterface
        public String getDailyMetricsJson(int days) {
            return database != null ? database.getDailyMetricsJson(days) : "[]";
        }

        @JavascriptInterface
        public String getStepStatusJson() {
            int steps = getTodayStepsInternal();
            String confidence = prefs.getString("step_ledger_confidence", "waiting");
            return "{\"steps\":" + steps +
                    ",\"sensorAvailable\":" + (stepSensor != null) +
                    ",\"confidence\":\"" + confidence.replace("\"", "").replace("\\", "") + "\"}";
        }

        @JavascriptInterface
        public String getVersionAuditJson() {
            return database != null ? database.getVersionAuditJson() : "{}";
        }

        @JavascriptInterface
        public String appVersion() {
            return BuildConfig.VERSION_NAME;
        }
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            String[] permissions,
            int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_ACTIVITY &&
                grantResults.length > 0 &&
                grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            registerStepSensor();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE) {
            Uri[] results = null;
            if (resultCode == Activity.RESULT_OK) {
                if (data == null || data.getData() == null) {
                    if (cameraUri != null) results = new Uri[]{cameraUri};
                } else {
                    results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
                }
            }
            if (filePathCallback != null) {
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }
            cameraUri = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
                checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED) {
            registerStepSensor();
        }
    }

    @Override
    protected void onPause() {
        if (sensorRegistered && sensorManager != null) {
            sensorManager.unregisterListener(this);
            sensorRegistered = false;
        }
        super.onPause();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (sensorManager != null) sensorManager.unregisterListener(this);
        if (database != null) {
            database.close();
            database = null;
        }
        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
        }
        super.onDestroy();
    }
}
