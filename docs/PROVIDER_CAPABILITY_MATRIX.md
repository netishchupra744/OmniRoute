# Provider Capability Matrix

This matrix is deliberately conservative. A model is not approved for a Bijoy presenter scene merely because it appears in `open-sse/config/videoRegistry.ts`. Selection requires all project-critical capabilities to be supported together.

Legend: **Yes** = source evidence exists; **Forwarded** = handler forwards a field but the upstream result is not contract-tested; **No proof** = not established in checked-in source; **Disabled** = forbidden local provider in normal Bijoy UI.

| Provider group | Source evidence | Reference/I2V | Exact 10 s | 16:9 | 1080p | Native audio | Bangla voice | Lip-sync | Async task | Final timeline render | Bijoy presenter selectable now |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Runway (`runwayml`) | Registry plus Runway handler; duration clamped to max 10; task polling | Yes | Yes in handler | Yes | No proof | No proof | No proof | No proof | Yes | No | No |
| Alibaba/DashScope family | Registry/status URL; handlers forward duration and ratio for model families | Model-dependent | Forwarded | Forwarded | No proof | No proof | No proof | No proof | Yes where status URL exists | No | No |
| Google Flow (`googleflow`) | Helper forwards duration/ratio; task-style behavior | Model-dependent | Forwarded, unverified wire result | Forwarded | No proof | Provider/model dependent, not proven | No proof | No proof | Yes | No | No |
| Adobe Firefly | Handler forwards `generateAudio`; async workflow | Model-dependent | No proof | Yes/forwarded | No proof | Yes, provider option exists | No proof | No proof | Yes | No | No |
| Novita | Handler forwards duration/dimensions | Model-dependent | Forwarded | Yes/forwarded | No proof | No proof | No proof | No proof | Provider-defined | No | No |
| MiniMax, Replicate, Together, Leonardo, Haiper, DeepInfra and similar registry providers | Model/endpoint registration; some status URLs | Model-ID dependent | No proof | No proof or model-defined | No proof | No proof | No proof | No proof | Some | No | No |
| Pollinations / no-auth web providers | Registry presence | No reliable proof | No proof | No proof | No proof | No proof | No proof | No proof | Provider-defined | No | No |
| ComfyUI | `http://localhost:8188` | Local workflows | Local | Local | Local | Local | Local | Local | Local | Local | **Disabled** |
| Stable Diffusion WebUI | `http://localhost:7860` | Local workflows | Local | Local | Local | Local | Local | Local | Local | Local | **Disabled** |
| Final render adapters | New Bijoy adapter registry | N/A | Enforces 33 × 10 input | Enforces 16:9 | Enforces 1920×1080 | Optional mix | N/A | N/A | Required | Adapter contract | None registered |

## Capability metadata implemented

Each video model can now be evaluated against:

- `supportsTextToVideo`
- `supportsImageToVideo`
- `supportsReferenceImage`
- `supportsNativeAudio`
- `supportsBanglaVoice`
- `supportsLipSync`
- `supportsTenSecondDuration`
- `supportsSixteenByNine`
- `supports1080p`
- `supportsSeed`
- `supportsAsyncJobs`
- `supportsFinalRendering`
- `maximumDuration`
- `supportedAspectRatios`
- `estimatedCost`
- `rateLimitCategory`

## Approval rule

A model may be enabled for the default Bangla presenter workflow only after provider-specific tests prove:

1. reference-image identity use;
2. exact 10-second output;
3. 16:9 output;
4. 1920×1080 output;
5. Bangla dialogue when native-audio mode is selected;
6. lip-sync when required;
7. task persistence/resume behavior;
8. actual cost and rate-limit behavior.

No unsupported capability is inferred from marketing names alone.
