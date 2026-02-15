# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | ✅ Yes             |
| < 0.2   | ❌ No              |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via:
- GitHub Security Advisories: https://github.com/zhuamber370/bridgetalk/security/advisories/new
- Or email: (to be configured)

You should receive a response within 48 hours. If the issue is confirmed, we will release a patch as soon as possible.

## Security Best Practices

When deploying BridgeTalk:

1. **Never commit `.env` files** - Use `.env.example` as template
2. **Rotate tokens regularly** - Change `OPENCLAW_GATEWAY_TOKEN` periodically
3. **Use HTTPS in production** - Encrypt all traffic
4. **Keep dependencies updated** - Run `pnpm update` regularly
5. **Enable CORS properly** - Configure allowed origins in server config

## Known Security Considerations

- This is a **local-first** application - all data stays on your device
- WebSocket connections to OpenClaw Gateway should use `wss://` in production
- SQLite database files should be protected with appropriate file permissions
