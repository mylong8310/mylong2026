import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:dartssh2/dartssh2.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:sqflite/sqflite.dart';
import 'package:url_launcher/url_launcher.dart';

class HostConfig {
  const HostConfig({
    this.id = 1,
    required this.name,
    required this.windowsHost,
    required this.windowsMac,
    required this.windowsUser,
    required this.windowsPort,
    required this.routerHost,
    required this.routerUser,
    required this.routerPort,
    required this.rdpPort,
    required this.vncPort,
    required this.wolInterface,
    required this.rdpUri,
    required this.vncUri,
  });

  final int id;
  final String name;
  final String windowsHost;
  final String windowsMac;
  final String windowsUser;
  final int windowsPort;
  final String routerHost;
  final String routerUser;
  final int routerPort;
  final int rdpPort;
  final int vncPort;
  final String wolInterface;
  final String rdpUri;
  final String vncUri;

  factory HostConfig.defaults() => const HostConfig(
        name: '远程主机',
        windowsHost: '',
        windowsMac: '',
        windowsUser: '',
        windowsPort: 22,
        routerHost: '',
        routerUser: 'root',
        routerPort: 22,
        rdpPort: 3389,
        vncPort: 5900,
        wolInterface: 'br-lan',
        rdpUri: 'rdp://{host}:{port}',
        vncUri: 'vnc://{host}:{port}',
      );

  bool get isConfigured =>
      windowsHost.trim().isNotEmpty &&
      windowsMac.trim().isNotEmpty &&
      windowsUser.trim().isNotEmpty &&
      routerHost.trim().isNotEmpty &&
      routerUser.trim().isNotEmpty;

  Map<String, Object?> toMap() => {
        'id': id,
        'name': name,
        'windows_host': windowsHost,
        'windows_mac': windowsMac,
        'windows_user': windowsUser,
        'windows_port': windowsPort,
        'router_host': routerHost,
        'router_user': routerUser,
        'router_port': routerPort,
        'rdp_port': rdpPort,
        'vnc_port': vncPort,
        'wol_interface': wolInterface,
        'rdp_uri': rdpUri,
        'vnc_uri': vncUri,
      };

  factory HostConfig.fromMap(Map<String, Object?> m) => HostConfig(
        id: (m['id'] as int?) ?? 1,
        name: (m['name'] as String?) ?? '远程主机',
        windowsHost: (m['windows_host'] as String?) ?? '',
        windowsMac: (m['windows_mac'] as String?) ?? '',
        windowsUser: (m['windows_user'] as String?) ?? '',
        windowsPort: (m['windows_port'] as int?) ?? 22,
        routerHost: (m['router_host'] as String?) ?? '',
        routerUser: (m['router_user'] as String?) ?? 'root',
        routerPort: (m['router_port'] as int?) ?? 22,
        rdpPort: (m['rdp_port'] as int?) ?? 3389,
        vncPort: (m['vnc_port'] as int?) ?? 5900,
        wolInterface: (m['wol_interface'] as String?) ?? 'br-lan',
        rdpUri: (m['rdp_uri'] as String?) ?? 'rdp://{host}:{port}',
        vncUri: (m['vnc_uri'] as String?) ?? 'vnc://{host}:{port}',
      );
}

class ConfigStore {
  Database? _db;
  Future<Database> get db async {
    if (_db != null) return _db!;
    final base = await getDatabasesPath();
    _db = await openDatabase(
      '$base/remote_host_controller.db',
      version: 1,
      onCreate: (db, _) async {
        await db.execute('''
CREATE TABLE host_config (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL,
 windows_host TEXT NOT NULL, windows_mac TEXT NOT NULL,
 windows_user TEXT NOT NULL, windows_port INTEGER NOT NULL,
 router_host TEXT NOT NULL, router_user TEXT NOT NULL,
 router_port INTEGER NOT NULL, rdp_port INTEGER NOT NULL,
 vnc_port INTEGER NOT NULL, wol_interface TEXT NOT NULL,
 rdp_uri TEXT NOT NULL, vnc_uri TEXT NOT NULL
)''');
        await db.insert('host_config', HostConfig.defaults().toMap());
      },
    );
    return _db!;
  }

  Future<HostConfig> load() async {
    final database = await db;
    final rows = await database.query('host_config', where: 'id = 1');
    return rows.isEmpty ? HostConfig.defaults() : HostConfig.fromMap(rows.first);
  }

  Future<void> save(HostConfig c) async {
    final database = await db;
    await database.insert('host_config', c.toMap(), conflictAlgorithm: ConflictAlgorithm.replace);
  }
}

class SecureStore {
  final FlutterSecureStorage _s = const FlutterSecureStorage(aOptions: AndroidOptions());
  static const windowsKeyName = 'ssh.windows.private_key';
  static const routerKeyName = 'ssh.router.private_key';
  static const windowsPassName = 'ssh.windows.passphrase';
  static const routerPassName = 'ssh.router.passphrase';

  Future<String?> windowsKey() => _s.read(key: windowsKeyName);
  Future<String?> routerKey() => _s.read(key: routerKeyName);
  Future<String?> windowsPass() => _s.read(key: windowsPassName);
  Future<String?> routerPass() => _s.read(key: routerPassName);

  Future<void> saveKey({required bool windows, required String pem}) async {
    await _s.write(key: windows ? windowsKeyName : routerKeyName, value: pem.trim());
  }

  Future<void> deleteKey({required bool windows}) async {
    await _s.delete(key: windows ? windowsKeyName : routerKeyName);
    await _s.delete(key: windows ? windowsPassName : routerPassName);
  }

  Future<bool> hasKey(bool windows) async =>
      ((await (windows ? windowsKey() : routerKey())) ?? '').trim().isNotEmpty;

  String _hostKeyName(String host, int port) =>
      'known_host.${base64Url.encode(utf8.encode('$host:$port'))}';

  Future<String?> knownHost(String host, int port) => _s.read(key: _hostKeyName(host, port));
  Future<void> saveKnownHost(String host, int port, String value) =>
      _s.write(key: _hostKeyName(host, port), value: value);
}

class SshResult {
  const SshResult(this.exitCode, this.stdout, this.stderr);
  final int? exitCode;
  final String stdout;
  final String stderr;
  bool get ok => exitCode == null || exitCode == 0;
}

class SshEngine {
  SshEngine(this.secure);
  final SecureStore secure;

  Future<SshResult> run({
    required String host,
    required int port,
    required String username,
    required String privateKey,
    required String command,
    String? passphrase,
  }) async {
    if (privateKey.trim().isEmpty) throw StateError('SSH 私钥未配置');
    final socket = await SSHSocket.connect(host, port, timeout: const Duration(seconds: 6));
    final keys = SSHKeyPair.fromPem(
      privateKey,
      passphrase?.trim().isNotEmpty == true ? passphrase : null,
    );
    final client = SSHClient(
      socket,
      username: username,
      identities: [...keys],
      handshakeTimeout: const Duration(seconds: 8),
      authTimeout: const Duration(seconds: 8),
      onVerifyHostKey: (type, fingerprintBytes) async {
        final fp = base64.encode(fingerprintBytes);
        final known = await secure.knownHost(host, port);
        if (known == null) {
          await secure.saveKnownHost(host, port, fp);
          return true;
        }
        return known == fp;
      },
    );
    try {
      await client.authenticated;
      final r = await client.runWithResult(command);
      return SshResult(
        r.exitCode,
        utf8.decode(r.stdout, allowMalformed: true).trim(),
        utf8.decode(r.stderr, allowMalformed: true).trim(),
      );
    } finally {
      await client.close();
    }
  }
}

enum HostState { off, booting, ready, rdpAbnormal }

class Telemetry {
  const Telemetry(this.cpu, this.gpu);
  final double? cpu;
  final double? gpu;
}

class HostController extends ChangeNotifier {
  HostController(this.store, this.secure) : ssh = SshEngine(secure);
  final ConfigStore store;
  final SecureStore secure;
  final SshEngine ssh;

  HostConfig config = HostConfig.defaults();
  HostState state = HostState.off;
  Telemetry telemetry = const Telemetry(null, null);
  bool busy = false;
  String? error;
  DateTime? checkedAt;
  Timer? timer;

  Future<void> init() async {
    config = await store.load();
    notifyListeners();
    if (config.isConfigured) {
      await refresh();
      _startPolling();
    }
  }

  Future<void> save(HostConfig c) async {
    config = c;
    await store.save(c);
    error = null;
    notifyListeners();
    if (c.isConfigured) {
      await refresh();
      _startPolling();
    } else {
      timer?.cancel();
    }
  }

  Future<bool> tcp(String host, int port, {Duration timeout = const Duration(milliseconds: 1400)}) async {
    Socket? socket;
    try {
      socket = await Socket.connect(host, port, timeout: timeout);
      return true;
    } catch (_) {
      return false;
    } finally {
      socket?.destroy();
    }
  }

  Future<bool> reachable() async {
    final host = config.windowsHost.trim();
    if (host.isEmpty) return false;
    try {
      final r = await Process.run('/system/bin/ping', ['-c', '1', '-W', '1', host])
          .timeout(const Duration(seconds: 2));
      if (r.exitCode == 0) return true;
    } catch (_) {}
    return tcp(host, config.windowsPort);
  }

  Future<void> refresh() async {
    if (!config.isConfigured || busy) return;
    try {
      final up = await reachable();
      if (!up) {
        state = HostState.off;
        telemetry = const Telemetry(null, null);
      } else {
        final rdp = await tcp(config.windowsHost, config.rdpPort);
        state = rdp ? HostState.ready : HostState.rdpAbnormal;
        if (rdp) telemetry = await readTelemetry();
      }
      checkedAt = DateTime.now();
      error = null;
    } catch (e) {
      error = '$e'.replaceFirst('Exception: ', '');
    }
    notifyListeners();
  }

  Future<void> wake() => _guard(() async {
        state = HostState.booting;
        telemetry = const Telemetry(null, null);
        notifyListeners();
        final key = await secure.routerKey();
        if (key == null || key.isEmpty) throw StateError('请先导入 iStoreOS SSH 私钥');
        final mac = config.windowsMac.trim().toUpperCase();
        if (!RegExp(r'^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$').hasMatch(mac)) {
          throw FormatException('MAC 地址格式不正确');
        }
        final iface = config.wolInterface.trim();
        if (!RegExp(r'^[A-Za-z0-9_.:-]+$').hasMatch(iface)) {
          throw FormatException('WOL 网卡接口格式不正确');
        }
        final cmd =
            "sh -lc 'if command -v etherwake >/dev/null 2>&1; then etherwake -i $iface $mac; "
            "elif command -v wakeonlan >/dev/null 2>&1; then wakeonlan $mac; "
            "elif command -v wol >/dev/null 2>&1; then wol $mac; "
            "else echo WOL_TOOL_NOT_FOUND >&2; exit 127; fi'";
        final r = await ssh.run(
          host: config.routerHost,
          port: config.routerPort,
          username: config.routerUser,
          privateKey: key,
          passphrase: await secure.routerPass(),
          command: cmd,
        );
        if (!r.ok) throw StateError(r.stderr.isNotEmpty ? r.stderr : 'WOL 执行失败');
        await _waitReady(const Duration(seconds: 90));
      });

  Future<void> shutdown() => _guard(() async {
        await _windowsPower(r'shutdown /s /t 0 /f');
        final until = DateTime.now().add(const Duration(seconds: 60));
        while (DateTime.now().isBefore(until)) {
          if (!await reachable()) {
            state = HostState.off;
            telemetry = const Telemetry(null, null);
            checkedAt = DateTime.now();
            notifyListeners();
            return;
          }
          await Future<void>.delayed(const Duration(seconds: 2));
        }
        throw TimeoutException('已发送关机命令，但主机仍在线');
      });

  Future<void> restart() => _guard(() async {
        await _windowsPower(r'shutdown /r /t 0 /f');
        state = HostState.booting;
        telemetry = const Telemetry(null, null);
        notifyListeners();
        await Future<void>.delayed(const Duration(seconds: 3));
        await _waitReady(const Duration(seconds: 120));
      });

  Future<void> _windowsPower(String command) async {
    final key = await secure.windowsKey();
    if (key == null || key.isEmpty) throw StateError('请先导入 Windows SSH 私钥');
    final r = await ssh.run(
      host: config.windowsHost,
      port: config.windowsPort,
      username: config.windowsUser,
      privateKey: key,
      passphrase: await secure.windowsPass(),
      command: command,
    );
    if (!r.ok) throw StateError(r.stderr.isNotEmpty ? r.stderr : '远程命令执行失败');
  }

  Future<void> _waitReady(Duration timeout) async {
    final until = DateTime.now().add(timeout);
    var seen = false;
    while (DateTime.now().isBefore(until)) {
      final up = await reachable();
      seen = seen || up;
      if (up) {
        if (await tcp(config.windowsHost, config.rdpPort)) {
          state = HostState.ready;
          telemetry = await readTelemetry();
          checkedAt = DateTime.now();
          notifyListeners();
          return;
        }
        state = HostState.booting;
        notifyListeners();
      }
      await Future<void>.delayed(const Duration(seconds: 2));
    }
    state = seen ? HostState.rdpAbnormal : HostState.off;
    notifyListeners();
    throw TimeoutException(seen ? '主机已在线，但 RDP 未就绪' : 'WOL 已发送，但未检测到主机');
  }

  Future<Telemetry> readTelemetry() async {
    final key = await secure.windowsKey();
    if (key == null || key.isEmpty) return const Telemetry(null, null);
    const ps = r'''powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=Get-CimInstance -Namespace 'root\LibreHardwareMonitor' -ClassName Sensor -ErrorAction SilentlyContinue | Where-Object { $_.SensorType -eq 'Temperature' -and ($_.Name -eq 'CPU Package' -or $_.Name -eq 'GPU Core') }; $s | Select-Object Name,Value | ConvertTo-Json -Compress"''';
    try {
      final r = await ssh.run(
        host: config.windowsHost,
        port: config.windowsPort,
        username: config.windowsUser,
        privateKey: key,
        passphrase: await secure.windowsPass(),
        command: ps,
      );
      if (!r.ok || r.stdout.isEmpty) return const Telemetry(null, null);
      final d = jsonDecode(r.stdout);
      final items = d is List ? d : [d];
      double? cpu;
      double? gpu;
      for (final item in items) {
        if (item is! Map) continue;
        final name = '${item['Name']}';
        final value = double.tryParse('${item['Value']}');
        if (name == 'CPU Package') cpu = value;
        if (name == 'GPU Core') gpu = value;
      }
      return Telemetry(cpu, gpu);
    } catch (_) {
      return const Telemetry(null, null);
    }
  }

  Future<void> openRemote(bool rdp) => _guard(() async {
        final template = rdp ? config.rdpUri : config.vncUri;
        final port = rdp ? config.rdpPort : config.vncPort;
        final label = rdp ? 'RDP' : 'VNC';
        final value = template
            .replaceAll('{host}', config.windowsHost.trim())
            .replaceAll('{port}', '$port');
        final uri = Uri.tryParse(value);
        if (uri == null) throw FormatException('$label URI 模板无效');
        final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
        if (!ok) throw StateError('没有找到可处理 $label 链接的客户端，请安装客户端或修改 URI 模板');
      });

  Future<void> _guard(Future<void> Function() fn) async {
    if (busy) return;
    busy = true;
    error = null;
    notifyListeners();
    try {
      await fn();
    } catch (e) {
      error = '$e'.replaceFirst('Bad state: ', '').replaceFirst('FormatException: ', '');
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  void clearError() {
    error = null;
    notifyListeners();
  }

  void _startPolling() {
    timer?.cancel();
    timer = Timer.periodic(const Duration(seconds: 15), (_) {
      if (!busy) refresh();
    });
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }
}
