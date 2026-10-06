package com.fitbalance.app;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class FitDatabase extends SQLiteOpenHelper {
    private static final String DB_NAME = "fitbalance.db";
    private static final int DB_VERSION = 2;
    private static final int ZHUANGZI_TOTAL_DAYS = 30;
    private final Context context;

    public FitDatabase(Context context) {
        super(context, DB_NAME, null, DB_VERSION);
        this.context = context.getApplicationContext();
        ensureZhuangziSeeded();
        ensureHealthRulesSeeded();
        ensureStartDate();
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        createCoreTables(db);
        createHealthRuleTables(db);
    }

    private void createCoreTables(SQLiteDatabase db) {
        db.execSQL(
                "CREATE TABLE IF NOT EXISTS zhuangzi_content (" +
                        "id INTEGER PRIMARY KEY," +
                        "day_no INTEGER UNIQUE NOT NULL," +
                        "chapter TEXT NOT NULL," +
                        "title TEXT NOT NULL," +
                        "original_text TEXT NOT NULL," +
                        "story TEXT NOT NULL," +
                        "interpretation TEXT NOT NULL," +
                        "action TEXT NOT NULL," +
                        "mood_tags TEXT NOT NULL," +
                        "health_tags TEXT NOT NULL," +
                        "priority INTEGER NOT NULL DEFAULT 0," +
                        "content_version INTEGER NOT NULL DEFAULT 1" +
                        ")"
        );

        db.execSQL(
                "CREATE TABLE IF NOT EXISTS zhuangzi_progress (" +
                        "day_no INTEGER PRIMARY KEY," +
                        "checked INTEGER NOT NULL DEFAULT 0," +
                        "checked_at TEXT" +
                        ")"
        );

        db.execSQL(
                "CREATE TABLE IF NOT EXISTS app_meta (" +
                        "key TEXT PRIMARY KEY," +
                        "value TEXT" +
                        ")"
        );

        db.execSQL(
                "CREATE TABLE IF NOT EXISTS sync_queue (" +
                        "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                        "entity_type TEXT NOT NULL," +
                        "entity_id TEXT," +
                        "operation TEXT NOT NULL," +
                        "payload TEXT," +
                        "created_at TEXT NOT NULL," +
                        "synced INTEGER NOT NULL DEFAULT 0" +
                        ")"
        );
    }

    private void createHealthRuleTables(SQLiteDatabase db) {
        db.execSQL(
                "CREATE TABLE IF NOT EXISTS evidence (" +
                        "id TEXT PRIMARY KEY," +
                        "title TEXT NOT NULL," +
                        "organization TEXT NOT NULL," +
                        "year INTEGER NOT NULL," +
                        "url TEXT NOT NULL," +
                        "evidence_level TEXT NOT NULL," +
                        "scope TEXT NOT NULL," +
                        "content_version INTEGER NOT NULL DEFAULT 1" +
                        ")"
        );

        db.execSQL(
                "CREATE TABLE IF NOT EXISTS food_disease_rules (" +
                        "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                        "food_id TEXT NOT NULL," +
                        "disease TEXT NOT NULL," +
                        "status TEXT NOT NULL," +
                        "reason TEXT NOT NULL," +
                        "evidence_id TEXT NOT NULL," +
                        "content_version INTEGER NOT NULL DEFAULT 1," +
                        "UNIQUE(food_id,disease)" +
                        ")"
        );

        db.execSQL("CREATE INDEX IF NOT EXISTS idx_food_rules_food ON food_disease_rules(food_id)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_food_rules_disease ON food_disease_rules(disease)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        if (oldVersion < 2) {
            createHealthRuleTables(db);
        }
    }

    private String nowIso() {
        return new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).format(new Date());
    }

    private String today() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    private String readAsset(String name) throws Exception {
        try (InputStream in = context.getAssets().open(name);
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int n;
            while ((n = in.read(buffer)) > 0) out.write(buffer, 0, n);
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    private void ensureZhuangziSeeded() {
        SQLiteDatabase db = getWritableDatabase();
        long count = 0;
        try (Cursor c = db.rawQuery("SELECT COUNT(*) FROM zhuangzi_content", null)) {
            if (c.moveToFirst()) count = c.getLong(0);
        }
        if (count >= ZHUANGZI_TOTAL_DAYS) return;

        db.beginTransaction();
        try {
            JSONObject root = new JSONObject(readAsset("zhuangzi_seed.json"));
            int version = root.optInt("version", 1);
            JSONArray days = root.getJSONArray("days");
            db.delete("zhuangzi_content", null, null);

            for (int i = 0; i < days.length(); i++) {
                JSONObject o = days.getJSONObject(i);
                ContentValues v = new ContentValues();
                v.put("id", o.getInt("id"));
                v.put("day_no", o.getInt("day_no"));
                v.put("chapter", o.getString("chapter"));
                v.put("title", o.getString("title"));
                v.put("original_text", o.optString("original_text", ""));
                v.put("story", o.getString("story"));
                v.put("interpretation", o.getString("interpretation"));
                v.put("action", o.getString("action"));
                v.put("mood_tags", o.optJSONArray("mood_tags") != null
                        ? o.getJSONArray("mood_tags").toString() : "[]");
                v.put("health_tags", o.optJSONArray("health_tags") != null
                        ? o.getJSONArray("health_tags").toString() : "[]");
                v.put("priority", o.optInt("priority", 0));
                v.put("content_version", version);
                db.insertOrThrow("zhuangzi_content", null, v);
            }

            ContentValues meta = new ContentValues();
            meta.put("key", "zhuangzi_content_version");
            meta.put("value", String.valueOf(version));
            db.insertWithOnConflict("app_meta", null, meta, SQLiteDatabase.CONFLICT_REPLACE);

            db.setTransactionSuccessful();
        } catch (Exception e) {
            throw new RuntimeException("Failed to seed Zhuangzi content", e);
        } finally {
            db.endTransaction();
        }
    }

    private void ensureHealthRulesSeeded() {
        SQLiteDatabase db = getWritableDatabase();
        createHealthRuleTables(db);

        String current = getMeta(db, "health_rules_version");
        try {
            JSONObject root = new JSONObject(readAsset("health_rules_seed.json"));
            int version = root.optInt("version", 1);
            if (String.valueOf(version).equals(current)) return;

            db.beginTransaction();
            try {
                db.delete("food_disease_rules", null, null);
                db.delete("evidence", null, null);

                JSONArray evidence = root.getJSONArray("evidence");
                for (int i = 0; i < evidence.length(); i++) {
                    JSONObject o = evidence.getJSONObject(i);
                    ContentValues v = new ContentValues();
                    v.put("id", o.getString("id"));
                    v.put("title", o.getString("title"));
                    v.put("organization", o.getString("organization"));
                    v.put("year", o.getInt("year"));
                    v.put("url", o.getString("url"));
                    v.put("evidence_level", o.getString("level"));
                    v.put("scope", o.getString("scope"));
                    v.put("content_version", version);
                    db.insertOrThrow("evidence", null, v);
                }

                JSONArray rules = root.getJSONArray("rules");
                for (int i = 0; i < rules.length(); i++) {
                    JSONArray row = rules.getJSONArray(i);
                    ContentValues v = new ContentValues();
                    v.put("food_id", row.getString(0));
                    v.put("disease", row.getString(1));
                    v.put("status", row.getString(2));
                    v.put("reason", row.getString(3));
                    v.put("evidence_id", row.getString(4));
                    v.put("content_version", version);
                    db.insertOrThrow("food_disease_rules", null, v);
                }

                ContentValues meta = new ContentValues();
                meta.put("key", "health_rules_version");
                meta.put("value", String.valueOf(version));
                db.insertWithOnConflict("app_meta", null, meta, SQLiteDatabase.CONFLICT_REPLACE);

                db.setTransactionSuccessful();
            } finally {
                db.endTransaction();
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to seed health rules", e);
        }
    }

    private void ensureStartDate() {
        SQLiteDatabase db = getWritableDatabase();
        String value = getMeta(db, "zhuangzi_start_date");
        if (value == null || value.isEmpty()) {
            ContentValues meta = new ContentValues();
            meta.put("key", "zhuangzi_start_date");
            meta.put("value", today());
            db.insertWithOnConflict("app_meta", null, meta, SQLiteDatabase.CONFLICT_REPLACE);
        }
    }

    private String getMeta(SQLiteDatabase db, String key) {
        try (Cursor c = db.query(
                "app_meta",
                new String[]{"value"},
                "key=?",
                new String[]{key},
                null, null, null)) {
            if (c.moveToFirst()) return c.getString(0);
        }
        return null;
    }

    private int getCurrentDayNumber() {
        SQLiteDatabase db = getReadableDatabase();
        String start = getMeta(db, "zhuangzi_start_date");
        if (start == null || start.isEmpty()) return 1;
        try {
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            f.setLenient(false);
            Date a = f.parse(start);
            Date b = f.parse(today());
            if (a == null || b == null) return 1;
            long days = Math.max(0, (b.getTime() - a.getTime()) / 86400000L);
            return Math.min(ZHUANGZI_TOTAL_DAYS, (int) days + 1);
        } catch (Exception e) {
            return 1;
        }
    }

    private boolean isCycleComplete() {
        SQLiteDatabase db = getReadableDatabase();
        String start = getMeta(db, "zhuangzi_start_date");
        if (start == null || start.isEmpty()) return false;
        try {
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            Date a = f.parse(start);
            Date b = f.parse(today());
            if (a == null || b == null) return false;
            return (b.getTime() - a.getTime()) / 86400000L >= ZHUANGZI_TOTAL_DAYS;
        } catch (Exception e) {
            return false;
        }
    }

    public String getZhuangziDayJson(int dayNo) {
        int safeDay = Math.max(1, Math.min(ZHUANGZI_TOTAL_DAYS, dayNo));
        SQLiteDatabase db = getReadableDatabase();

        try (Cursor c = db.rawQuery(
                "SELECT c.id,c.day_no,c.chapter,c.title,c.original_text,c.story,c.interpretation,c.action," +
                        "c.mood_tags,c.health_tags,c.priority,COALESCE(p.checked,0) " +
                        "FROM zhuangzi_content c LEFT JOIN zhuangzi_progress p ON c.day_no=p.day_no " +
                        "WHERE c.day_no=? LIMIT 1",
                new String[]{String.valueOf(safeDay)})) {

            if (!c.moveToFirst()) return "{}";

            JSONObject o = new JSONObject();
            o.put("id", c.getInt(0));
            o.put("day_no", c.getInt(1));
            o.put("chapter", c.getString(2));
            o.put("title", c.getString(3));
            o.put("original_text", c.getString(4));
            o.put("story", c.getString(5));
            o.put("interpretation", c.getString(6));
            o.put("action", c.getString(7));
            o.put("mood_tags", new JSONArray(c.getString(8)));
            o.put("health_tags", new JSONArray(c.getString(9)));
            o.put("priority", c.getInt(10));
            o.put("checked", c.getInt(11) == 1);
            return o.toString();
        } catch (Exception e) {
            return "{}";
        }
    }

    public String getZhuangziStatusJson() {
        SQLiteDatabase db = getReadableDatabase();
        int checkedCount = 0;
        try (Cursor c = db.rawQuery(
                "SELECT COUNT(*) FROM zhuangzi_progress WHERE checked=1",
                null)) {
            if (c.moveToFirst()) checkedCount = c.getInt(0);
        }

        int currentDay = getCurrentDayNumber();
        JSONObject out = new JSONObject();
        try {
            out.put("current_day", currentDay);
            out.put("total_days", ZHUANGZI_TOTAL_DAYS);
            out.put("checked_count", checkedCount);
            out.put("cycle_complete", isCycleComplete());
            out.put("start_date", getMeta(db, "zhuangzi_start_date"));
            out.put("content_version", getMeta(db, "zhuangzi_content_version"));
            out.put("current", new JSONObject(getZhuangziDayJson(currentDay)));
        } catch (Exception ignored) {
        }
        return out.toString();
    }

    public boolean setZhuangziCheckin(int dayNo, boolean checked) {
        int safeDay = Math.max(1, Math.min(ZHUANGZI_TOTAL_DAYS, dayNo));
        SQLiteDatabase db = getWritableDatabase();

        ContentValues v = new ContentValues();
        v.put("day_no", safeDay);
        v.put("checked", checked ? 1 : 0);
        v.put("checked_at", checked ? nowIso() : null);

        return db.insertWithOnConflict(
                "zhuangzi_progress",
                null,
                v,
                SQLiteDatabase.CONFLICT_REPLACE
        ) != -1;
    }

    private int severity(String status) {
        if ("red".equals(status)) return 3;
        if ("yellow".equals(status)) return 2;
        if ("green".equals(status)) return 1;
        return 0;
    }

    private JSONObject readFoodRule(SQLiteDatabase db, String foodId, String disease) {
        try (Cursor c = db.rawQuery(
                "SELECT r.status,r.reason,r.evidence_id,e.title,e.organization,e.year,e.url,e.evidence_level " +
                        "FROM food_disease_rules r LEFT JOIN evidence e ON r.evidence_id=e.id " +
                        "WHERE r.food_id=? AND r.disease=? LIMIT 1",
                new String[]{foodId, disease})) {
            if (!c.moveToFirst()) return null;
            JSONObject o = new JSONObject();
            o.put("disease", disease);
            o.put("status", c.getString(0));
            o.put("reason", c.getString(1));
            o.put("evidence_id", c.getString(2));
            JSONObject e = new JSONObject();
            e.put("title", c.getString(3));
            e.put("organization", c.getString(4));
            e.put("year", c.getInt(5));
            e.put("url", c.getString(6));
            e.put("level", c.getString(7));
            o.put("evidence", e);
            return o;
        } catch (Exception e) {
            return null;
        }
    }

    public String evaluateFoodRiskJson(String foodId, String profileJson) {
        JSONObject out = new JSONObject();
        JSONArray items = new JSONArray();
        try {
            JSONObject p = new JSONObject(profileJson == null ? "{}" : profileJson);
            List<String> diseases = new ArrayList<>();
            if (p.optBoolean("gout", false)) diseases.add("gout");
            if (p.optBoolean("diabetes", false)) diseases.add("diabetes");
            if (p.optBoolean("hypertension", false)) diseases.add("hypertension");
            if (p.optBoolean("heartDisease", false) ||
                    p.optBoolean("priorMI", false) ||
                    p.optBoolean("priorStroke", false)) {
                diseases.add("cardiovascular");
            }

            SQLiteDatabase db = getReadableDatabase();
            String worst = "neutral";
            int worstSeverity = 0;

            for (String disease : diseases) {
                JSONObject rule = readFoodRule(db, foodId, disease);
                if (rule == null) continue;
                items.put(rule);
                int s = severity(rule.optString("status", "neutral"));
                if (s > worstSeverity) {
                    worstSeverity = s;
                    worst = rule.optString("status", "neutral");
                }
            }

            out.put("food_id", foodId);
            out.put("status", worst);
            out.put("items", items);
            out.put("has_rules", items.length() > 0);
            out.put("rules_version", getMeta(db, "health_rules_version"));
        } catch (Exception ignored) {
        }
        return out.toString();
    }
}
