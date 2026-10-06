import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'core.dart';

class RemoteHostApp extends StatefulWidget {
  const RemoteHostApp({super.key});
  @override
  State<RemoteHostApp> createState() => _RemoteHostAppState();
}

class _RemoteHostAppState extends State<RemoteHostApp> {
  late final SecureStore secure;
  late final HostController controller;

  @override
  void initState() {
    super.initState();
    secure = SecureStore();
    controller = HostController(ConfigStore(), secure)..init();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = ColorScheme.fromSeed(seedColor: const Color(0xFF4F7CFF), brightness: Brightness.dark);
    return MaterialApp(
      title: '远程主机',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: scheme,
        scaffoldBackgroundColor: const Color(0xFF0D1017),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: scheme.surfaceContainerHigh,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
        ),
        cardTheme: CardThemeData(
          elevation: 0,
          color: scheme.surfaceContainer,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        ),
      ),
      home: HomePage(controller: controller, secure: secure),
    );
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }
}

class HomePage extends StatelessWidget {
  const HomePage({super.key, required this.controller, required this.secure});
  final HostController controller;
  final SecureStore secure;

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: controller,
        builder: (context, _) {
          final c = controller;
          return Scaffold(
            appBar: AppBar(
              title: Text(c.config.name),
              actions: [
                IconButton(
                  onPressed: () async {
                    final next = await Navigator.of(context).push<HostConfig>(
                      MaterialPageRoute(builder: (_) => SettingsPage(initial: c.config, secure: secure)),
                    );
                    if (next != null) await c.save(next);
                  },
                  icon: const Icon(Icons.settings_rounded),
                ),
              ],
            ),
            body: SafeArea(
              child: RefreshIndicator(
                onRefresh: c.refresh,
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(20, 18, 20, 30),
                  children: [
                    if (!c.config.isConfigured)
                      const Card(child: Padding(padding: EdgeInsets.all(16), child: Text('首次使用：点右上角设置，填写 Windows、iStoreOS、RDP/VNC 参数，并导入两端 SSH 私钥。'))),
                    Center(child: _StatusChip(c.state)),
                    const SizedBox(height: 24),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 18),
                        child: Row(
                          children: [
                            Expanded(child: _Temp('CPU Package', c.telemetry.cpu, Icons.memory_rounded)),
                            const SizedBox(height: 42, child: VerticalDivider()),
                            Expanded(child: _Temp('GPU Core', c.telemetry.gpu, Icons.developer_board_rounded)),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 18),
                    if (c.busy) const LinearProgressIndicator(),
                    if (c.busy) const SizedBox(height: 12),
                    GridView.count(
                      crossAxisCount: 2,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                      childAspectRatio: 1.35,
                      children: [
                        _Action('开机', Icons.power_rounded, c.config.isConfigured && !c.busy && c.state == HostState.off, c.wake),
                        _Action('状态', Icons.radar_rounded, c.config.isConfigured && !c.busy, c.refresh),
                        _Action('RDP', Icons.desktop_windows_rounded, c.config.isConfigured && !c.busy && c.state != HostState.off, () => c.openRemote(true)),
                        _Action('VNC', Icons.visibility_rounded, c.config.isConfigured && !c.busy && c.state != HostState.off, () async {
                          final ok = await showDialog<bool>(
                            context: context,
                            builder: (_) => AlertDialog(
                              title: const Text('打开 VNC'),
                              content: const Text('VNC 会显示远端当前桌面。仅在你有权访问该主机时使用；本 App 不进行后台截屏。'),
                              actions: [
                                TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('取消')),
                                FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('继续')),
                              ],
                            ),
                          );
                          if (ok == true) await c.openRemote(false);
                        }),
                        _Action('重启', Icons.restart_alt_rounded, c.config.isConfigured && !c.busy && c.state != HostState.off, () => _confirmPower(context, c, true)),
                        _Action('关机', Icons.power_settings_new_rounded, c.config.isConfigured && !c.busy && c.state != HostState.off, () => _confirmPower(context, c, false), destructive: true),
                      ],
                    ),
                    const SizedBox(height: 18),
                    Text(
                      '主机 ${c.config.windowsHost.isEmpty ? '未配置' : c.config.windowsHost} · RDP ${c.config.rdpPort} · VNC ${c.config.vncPort}',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 5),
                    const Text('使用前请先确认 ZeroTier 隧道已连通。', textAlign: TextAlign.center),
                    if (c.error != null) ...[
                      const SizedBox(height: 14),
                      Card(
                        color: Theme.of(context).colorScheme.errorContainer,
                        child: ListTile(
                          leading: const Icon(Icons.error_outline_rounded),
                          title: const Text('操作失败'),
                          subtitle: Text(c.error!),
                          trailing: IconButton(onPressed: c.clearError, icon: const Icon(Icons.close_rounded)),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          );
        },
      );

  static Future<void> _confirmPower(BuildContext context, HostController c, bool restart) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(restart ? '确认重启？' : '确认关机？'),
        content: Text(restart ? 'Windows 将立即强制关闭运行中的程序并重启。' : 'Windows 将立即强制关闭运行中的程序并关机。'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('取消')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: Text(restart ? '重启' : '关机')),
        ],
      ),
    );
    if (ok == true) restart ? await c.restart() : await c.shutdown();
  }
}

class _Temp extends StatelessWidget {
  const _Temp(this.label, this.value, this.icon);
  final String label;
  final double? value;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Column(
        children: [
          Icon(icon, size: 20),
          const SizedBox(height: 6),
          Text(value == null ? '--' : '${value!.toStringAsFixed(0)}°C', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
          Text(label, style: Theme.of(context).textTheme.bodySmall),
        ],
      );
}

class _Action extends StatelessWidget {
  const _Action(this.label, this.icon, this.enabled, this.onTap, {this.destructive = false});
  final String label;
  final IconData icon;
  final bool enabled;
  final Future<void> Function() onTap;
  final bool destructive;
  @override
  Widget build(BuildContext context) => Card(
        child: InkWell(
          borderRadius: BorderRadius.circular(22),
          onTap: enabled ? () => onTap() : null,
          child: Opacity(
            opacity: enabled ? 1 : .4,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: 30, color: destructive ? Theme.of(context).colorScheme.error : null),
                const SizedBox(height: 8),
                Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
              ],
            ),
          ),
        ),
      );
}

class _StatusChip extends StatelessWidget {
  const _StatusChip(this.state);
  final HostState state;
  @override
  Widget build(BuildContext context) {
    final (label, icon) = switch (state) {
      HostState.off => ('已关机', Icons.circle_outlined),
      HostState.booting => ('正在启动', Icons.hourglass_top_rounded),
      HostState.ready => ('Windows 已启动', Icons.check_circle_rounded),
      HostState.rdpAbnormal => ('主机在线，RDP 异常', Icons.warning_amber_rounded),
    };
    return Chip(avatar: Icon(icon, size: 18), label: Text(label));
  }
}

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key, required this.initial, required this.secure});
  final HostConfig initial;
  final SecureStore secure;
  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  late final Map<String, TextEditingController> c;
  bool windowsKey = false;
  bool routerKey = false;

  @override
  void initState() {
    super.initState();
    final h = widget.initial;
    c = {
      'name': TextEditingController(text: h.name),
      'windowsHost': TextEditingController(text: h.windowsHost),
      'windowsMac': TextEditingController(text: h.windowsMac),
      'windowsUser': TextEditingController(text: h.windowsUser),
      'windowsPort': TextEditingController(text: '${h.windowsPort}'),
      'routerHost': TextEditingController(text: h.routerHost),
      'routerUser': TextEditingController(text: h.routerUser),
      'routerPort': TextEditingController(text: '${h.routerPort}'),
      'rdpPort': TextEditingController(text: '${h.rdpPort}'),
      'vncPort': TextEditingController(text: '${h.vncPort}'),
      'wolInterface': TextEditingController(text: h.wolInterface),
      'rdpUri': TextEditingController(text: h.rdpUri),
      'vncUri': TextEditingController(text: h.vncUri),
    };
    _refreshKeys();
  }

  Future<void> _refreshKeys() async {
    final w = await widget.secure.hasKey(true);
    final r = await widget.secure.hasKey(false);
    if (!mounted) return;
    setState(() {
      windowsKey = w;
      routerKey = r;
    });
  }

  int _port(String key, int fallback) {
    final value = int.tryParse(c[key]!.text.trim());
    return value != null && value > 0 && value <= 65535 ? value : fallback;
  }

  HostConfig _build() => HostConfig(
        name: c['name']!.text.trim().isEmpty ? '远程主机' : c['name']!.text.trim(),
        windowsHost: c['windowsHost']!.text.trim(),
        windowsMac: c['windowsMac']!.text.trim(),
        windowsUser: c['windowsUser']!.text.trim(),
        windowsPort: _port('windowsPort', 22),
        routerHost: c['routerHost']!.text.trim(),
        routerUser: c['routerUser']!.text.trim(),
        routerPort: _port('routerPort', 22),
        rdpPort: _port('rdpPort', 3389),
        vncPort: _port('vncPort', 5900),
        wolInterface: c['wolInterface']!.text.trim().isEmpty ? 'br-lan' : c['wolInterface']!.text.trim(),
        rdpUri: c['rdpUri']!.text.trim().isEmpty ? 'rdp://{host}:{port}' : c['rdpUri']!.text.trim(),
        vncUri: c['vncUri']!.text.trim().isEmpty ? 'vnc://{host}:{port}' : c['vncUri']!.text.trim(),
      );

  Future<void> _pasteKey(bool windows) async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    final pem = data?.text?.trim() ?? '';
    if (!pem.contains('PRIVATE KEY')) {
      _snack('剪贴板中没有识别到 SSH 私钥 PEM');
      return;
    }
    await widget.secure.saveKey(windows: windows, pem: pem);
    await _refreshKeys();
    _snack(windows ? 'Windows SSH 私钥已保存' : 'iStoreOS SSH 私钥已保存');
  }

  void _snack(String s) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(s)));
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('主机配置'),
          actions: [TextButton(onPressed: () => Navigator.pop(context, _build()), child: const Text('保存'))],
        ),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
          children: [
            _section('Windows 主机', [
              _field('名称', 'name'),
              _field('IP / ZeroTier 可达地址', 'windowsHost', hint: '192.168.1.20'),
              _field('MAC 地址', 'windowsMac', hint: 'AA:BB:CC:DD:EE:FF'),
              _field('SSH 用户', 'windowsUser'),
              _field('SSH 端口', 'windowsPort', number: true),
            ]),
            _keyCard('Windows SSH 私钥', windowsKey, true),
            _section('iStoreOS / WOL', [
              _field('iStoreOS 地址', 'routerHost', hint: '192.168.1.3'),
              _field('SSH 用户', 'routerUser'),
              _field('SSH 端口', 'routerPort', number: true),
              _field('WOL 网卡接口', 'wolInterface', hint: 'br-lan'),
            ]),
            _keyCard('iStoreOS SSH 私钥', routerKey, false),
            _section('远程桌面', [
              _field('RDP 端口', 'rdpPort', number: true),
              _field('VNC 端口', 'vncPort', number: true),
              _field('RDP URI 模板', 'rdpUri'),
              _field('VNC URI 模板', 'vncUri'),
            ]),
            const SizedBox(height: 8),
            const Text('所有参数都可以自行填写和改写。URI 模板支持 {host} 和 {port}；不同客户端格式不同时可直接改。'),
            const SizedBox(height: 12),
            const Text('SSH 私钥保存在 Android 安全存储中。VNC 仅在主动点击后打开，本 App 不做后台截屏。'),
          ],
        ),
      );

  Widget _section(String title, List<Widget> children) => Padding(
        padding: const EdgeInsets.only(top: 18, bottom: 8),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),
          ...children,
        ]),
      );

  Widget _field(String label, String key, {String? hint, bool number = false}) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: TextField(
          controller: c[key],
          keyboardType: number ? TextInputType.number : null,
          decoration: InputDecoration(labelText: label, hintText: hint),
        ),
      );

  Widget _keyCard(String title, bool configured, bool windows) => Card(
        child: ListTile(
          leading: Icon(configured ? Icons.key_rounded : Icons.key_off_rounded),
          title: Text(title),
          subtitle: Text(configured ? '已配置，可重新粘贴覆盖' : '未配置'),
          trailing: Wrap(spacing: 2, children: [
            IconButton(onPressed: () => _pasteKey(windows), icon: const Icon(Icons.content_paste_rounded)),
            if (configured)
              IconButton(
                onPressed: () async {
                  await widget.secure.deleteKey(windows: windows);
                  await _refreshKeys();
                },
                icon: const Icon(Icons.delete_outline_rounded),
              ),
          ]),
        ),
      );

  @override
  void dispose() {
    for (final x in c.values) x.dispose();
    super.dispose();
  }
}
