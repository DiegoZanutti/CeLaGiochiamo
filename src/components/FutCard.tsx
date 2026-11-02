import React from 'react';
import { Player } from '../types/models';
import {
  computePlayerMetrics,
  FutCardTier,
  getFutCardTier,
  getPlayerFutOverall,
  weightToFutStat,
} from '../engine/mathEngine';
import { useApp } from '../context/AppContext';
import { X, Shield, Crosshair, Award } from 'lucide-react';

interface FutCardProps {
  player: Player;
  onClick?: (player: Player) => void;
  size?: 'sm' | 'md' | 'lg';
  highlightBadge?: string;
}

interface TierVisualConfig {
  tierName: string;
  outerStroke: string;
  innerStroke: string;
  bgStops: [string, string, string];
  waveStrokeA: string;
  waveStrokeB: string;
  textPrimary: string;
  textSecondary: string;
  dividerColor: string;
  silhouetteFill: string;
  badgeRing: string;
}

const TIER_VISUALS: Record<FutCardTier, TierVisualConfig> = {
  SPECIAL: {
    tierName: 'SPECIAL',
    outerStroke: '#e4ff30',
    innerStroke: '#c8e619',
    bgStops: ['#16103a', '#1d144f', '#0d0926'],
    waveStrokeA: 'rgba(244, 63, 94, 0.55)',
    waveStrokeB: 'rgba(56, 189, 248, 0.45)',
    textPrimary: '#e4ff30',
    textSecondary: '#f4ff9e',
    dividerColor: 'rgba(236, 72, 153, 0.65)',
    silhouetteFill: 'rgba(228, 255, 48, 0.72)',
    badgeRing: '#ef4444',
  },
  GOLD: {
    tierName: 'ORO',
    outerStroke: '#fef08a',
    innerStroke: '#ca8a04',
    bgStops: ['#452707', '#78450f', '#291503'],
    waveStrokeA: 'rgba(250, 204, 21, 0.45)',
    waveStrokeB: 'rgba(245, 158, 11, 0.35)',
    textPrimary: '#fef08a',
    textSecondary: '#fde047',
    dividerColor: 'rgba(250, 204, 21, 0.5)',
    silhouetteFill: 'rgba(253, 224, 71, 0.65)',
    badgeRing: '#f59e0b',
  },
  SILVER: {
    tierName: 'ARGENTO',
    outerStroke: '#f1f5f9',
    innerStroke: '#94a3b8',
    bgStops: ['#1e293b', '#334155', '#0f172a'],
    waveStrokeA: 'rgba(148, 163, 184, 0.45)',
    waveStrokeB: 'rgba(56, 189, 248, 0.35)',
    textPrimary: '#f8fafc',
    textSecondary: '#cbd5e1',
    dividerColor: 'rgba(148, 163, 184, 0.5)',
    silhouetteFill: 'rgba(226, 232, 240, 0.62)',
    badgeRing: '#38bdf8',
  },
  BRONZE: {
    tierName: 'BRONZO',
    outerStroke: '#fed7aa',
    innerStroke: '#c2410c',
    bgStops: ['#3b1808', '#6b2c10', '#240d03'],
    waveStrokeA: 'rgba(251, 146, 60, 0.45)',
    waveStrokeB: 'rgba(217, 119, 6, 0.35)',
    textPrimary: '#ffedd5',
    textSecondary: '#fdba74',
    dividerColor: 'rgba(251, 146, 60, 0.5)',
    silhouetteFill: 'rgba(253, 186, 116, 0.62)',
    badgeRing: '#ea580c',
  },
};

// FUT Shield Path in a 260x370 coordinate system (matches attached FUT crest shape)
const SHIELD_OUTER_PATH =
  'M 130 8 C 118 22, 102 24, 90 14 C 66 24, 42 42, 14 54 L 14 274 C 14 294, 24 306, 44 313 C 82 325, 112 339, 130 360 C 148 339, 178 325, 216 313 C 236 306, 246 294, 246 274 L 246 54 C 218 42, 194 24, 170 14 C 158 24, 142 22, 130 8 Z';

const SHIELD_INNER_PATH =
  'M 130 16 C 119 28, 103 30, 91 21 C 69 30, 46 47, 21 58 L 21 272 C 21 289, 29 300, 48 306 C 84 318, 112 331, 130 350 C 148 331, 176 318, 212 306 C 231 300, 239 289, 239 272 L 239 58 C 214 47, 191 30, 169 21 C 157 30, 141 28, 130 16 Z';

export const FutCard: React.FC<FutCardProps> = ({
  player,
  onClick,
  size = 'md',
  highlightBadge,
}) => {
  const ovr = getPlayerFutOverall(player);
  const tier = getFutCardTier(ovr);
  const vis = TIER_VISUALS[tier];
  const uniqueId = `fut_${player.id.replace(/[^a-zA-Z0-9]/g, '')}`;

  const stats = {
    VEL: weightToFutStat(player.weights.velocita),
    TIR: weightToFutStat(player.weights.tiro),
    PAS: weightToFutStat(player.weights.passaggio),
    RES: weightToFutStat(player.weights.resistenza),
    DIF: weightToFutStat(player.weights.difesa),
    POR: weightToFutStat(player.weights.portiere),
  };

  const roleLabel = player.wants_to_be_gk ? 'POR' : player.computed.role_label;
  const isCompact = size === 'sm';
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick ? () => onClick(player) : undefined}
      aria-label={`Card FUT ${player.name} Overall ${ovr} Ruolo ${roleLabel}`}
      className={`relative group select-none text-left transition-transform duration-150 ${
        onClick
          ? 'cursor-pointer hover:-translate-y-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-3xl'
          : ''
      } ${isCompact ? 'w-full max-w-[195px]' : 'w-full max-w-[260px]'} mx-auto aspect-[260/370]`}
    >
      {/* Full SVG Crest Card Backbone & Artwork */}
      <svg
        viewBox="0 0 260 370"
        className="w-full h-full drop-shadow-[0_14px_24px_rgba(0,0,0,0.65)]"
        aria-hidden="true"
      >
        <defs>
          <clipPath id={`clip_${uniqueId}`}>
            <path d={SHIELD_INNER_PATH} />
          </clipPath>

          <linearGradient id={`bg_${uniqueId}`} x1="0%" y1="0%" x2="15%" y2="100%">
            <stop offset="0%" stopColor={vis.bgStops[0]} />
            <stop offset="52%" stopColor={vis.bgStops[1]} />
            <stop offset="100%" stopColor={vis.bgStops[2]} />
          </linearGradient>

          <linearGradient id={`fade_${uniqueId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={vis.bgStops[1]} stopOpacity="0" />
            <stop offset="68%" stopColor={vis.bgStops[1]} stopOpacity="0.15" />
            <stop offset="100%" stopColor={vis.bgStops[2]} stopOpacity="0.96" />
          </linearGradient>

          <linearGradient id={`portraitMask_${uniqueId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="72%" stopColor="white" stopOpacity="0.95" />
            <stop offset="96%" stopColor="white" stopOpacity="0" />
          </linearGradient>

          <mask id={`mask_photo_${uniqueId}`}>
            <rect x="65" y="20" width="180" height="162" fill={`url(#portraitMask_${uniqueId})`} />
          </mask>
        </defs>

        {/* Outer Crest Fill & Border */}
        <path
          d={SHIELD_OUTER_PATH}
          fill={`url(#bg_${uniqueId})`}
          stroke={vis.outerStroke}
          strokeWidth="4"
          strokeLinejoin="round"
        />

        {/* Clipped Interior Details */}
        <g clipPath={`url(#clip_${uniqueId})`}>
          {/* Dynamic Diagonal Energy Ribbons (Matching reference image) */}
          <path
            d="M -20 175 Q 95 70 270 30"
            fill="none"
            stroke={vis.waveStrokeA}
            strokeWidth="12"
            opacity="0.55"
          />
          <path
            d="M -20 195 Q 110 90 275 50"
            fill="none"
            stroke={vis.waveStrokeB}
            strokeWidth="6"
            opacity="0.65"
          />
          <path
            d="M -10 148 Q 85 50 255 12"
            fill="none"
            stroke={vis.outerStroke}
            strokeWidth="2.5"
            opacity="0.4"
          />
          <path
            d="M 15 210 Q 140 118 270 78"
            fill="none"
            stroke={vis.waveStrokeA}
            strokeWidth="4"
            opacity="0.5"
          />

          {/* Player Photo or Classic FUT Silhouette on Right */}
          {player.avatar_url ? (
            <image
              href={player.avatar_url}
              x="76"
              y="22"
              width="162"
              height="160"
              preserveAspectRatio="xMidYMin slice"
              mask={`url(#mask_photo_${uniqueId})`}
            />
          ) : (
            <g mask={`url(#mask_photo_${uniqueId})`} transform="translate(82, 26)">
              {/* Head & Bust Silhouette matching attached FUT reference */}
              <path
                d="M 74 14 C 52 14, 40 30, 42 56 C 43 69, 47 80, 54 88 L 54 98 C 34 108, 12 120, 4 142 L 4 156 L 154 156 L 154 142 C 144 120, 122 108, 100 98 L 100 88 C 107 80, 111 69, 112 56 C 114 30, 100 14, 74 14 Z"
                fill={vis.silhouetteFill}
              />
              {/* Subtle diagonal sheen across silhouette */}
              <path
                d="M 10 142 L 135 50"
                stroke={vis.outerStroke}
                strokeWidth="3"
                opacity="0.35"
              />
            </g>
          )}

          {/* Soft Darkening Gradient from Waist Down for Crisp Text Readability */}
          <rect x="0" y="122" width="260" height="245" fill={`url(#fade_${uniqueId})`} />

          {/* Left Column Decorative Badges: Tricolore Flag & Club Crest */}
          {/* Mini Tricolore Flag */}
          <g transform="translate(38, 102)">
            <rect x="0" y="0" width="32" height="19" rx="2.5" fill="#0f172a" stroke={vis.innerStroke} strokeWidth="1" />
            <rect x="1" y="1" width="10" height="17" fill="#10b981" />
            <rect x="11" y="1" width="10" height="17" fill="#f8fafc" />
            <rect x="21" y="1" width="10" height="17" fill="#ef4444" />
          </g>

          {/* Circular Club Ball Emblem */}
          <g transform="translate(54, 142)">
            <circle r="16" fill={vis.badgeRing} stroke={vis.outerStroke} strokeWidth="1.5" />
            <circle r="11.5" fill="#f8fafc" />
            <circle r="4.2" fill="#0f172a" />
            <circle cx="0" cy="-7" r="2.1" fill="#0f172a" />
            <circle cx="6.5" cy="-2.1" r="2.1" fill="#0f172a" />
            <circle cx="4.2" cy="5.6" r="2.1" fill="#0f172a" />
            <circle cx="-4.2" cy="5.6" r="2.1" fill="#0f172a" />
            <circle cx="-6.5" cy="-2.1" r="2.1" fill="#0f172a" />
          </g>

          {/* Horizontal Divider Below Player Name (y=204 -> 55.1% of 370) */}
          <line
            x1="36"
            y1="204"
            x2="224"
            y2="204"
            stroke={vis.dividerColor}
            strokeWidth="1.8"
          />

          {/* Vertical Center Divider Between the 2 Stat Columns (y=212..286 -> 57.3%..77.3% of 370) */}
          <line
            x1="130"
            y1="212"
            x2="130"
            y2="286"
            stroke={vis.dividerColor}
            strokeWidth="1.8"
          />

          {/* Short Bottom Accent Line Above Football Crest Point */}
          <line
            x1="112"
            y1="298"
            x2="148"
            y2="298"
            stroke={vis.dividerColor}
            strokeWidth="1.8"
          />

          {/* Bottom Crest Point Football Icon */}
          <g transform="translate(130, 318)">
            <circle r="9.5" fill="none" stroke={vis.outerStroke} strokeWidth="1.6" />
            <polygon
              points="0,-4.5 4.2,-1.4 2.6,3.6 -2.6,3.6 -4.2,-1.4"
              fill={vis.outerStroke}
            />
          </g>
        </g>

        {/* Inner Double Crest Border */}
        <path
          d={SHIELD_INNER_PATH}
          fill="none"
          stroke={vis.innerStroke}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>

      {/* HTML Text Overlay Aligned with Height-Relative Coordinates to the 260x370 Crest */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top-Left Rating & Position */}
        <div className="absolute top-[10.5%] left-[12.5%] flex flex-col items-center w-[32%]">
          <span
            style={{ color: vis.textPrimary }}
            className={`font-display font-extrabold leading-[0.88] tracking-tight tabular-nums ${
              isCompact ? 'text-2xl sm:text-3xl' : 'text-4xl'
            }`}
          >
            {ovr}
          </span>
          <span
            style={{ color: vis.textSecondary }}
            className={`font-display font-bold uppercase tracking-wider mt-0.5 ${
              isCompact ? 'text-[11px]' : 'text-sm'
            }`}
          >
            {roleLabel}
          </span>
        </div>

        {/* Player Name Banner (Above y=204 / 55.1% line) */}
        <div className="absolute top-[45.5%] h-[9%] left-[12%] right-[12%] flex flex-col items-center justify-end pb-0.5 text-center">
          <div
            style={{ color: vis.textPrimary }}
            className={`font-display font-extrabold uppercase tracking-wider truncate w-full leading-none drop-shadow ${
              isCompact ? 'text-xs sm:text-sm' : 'text-lg'
            }`}
          >
            {player.name}
          </div>
          {(player.nickname || highlightBadge) && (
            <div
              style={{ color: vis.textSecondary }}
              className="text-[10px] font-medium truncate w-full leading-tight opacity-90"
            >
              {highlightBadge ? highlightBadge : `«${player.nickname}»`}
            </div>
          )}
        </div>

        {/* 2-Column x 3-Row Attribute Matrix (Aligned to y=212..286 / 57.3%..77.3% of 370) */}
        <div
          className={`absolute top-[57.3%] h-[20.2%] left-[13%] right-[13%] grid grid-cols-2 grid-rows-3 items-center gap-x-4 font-display font-bold tabular-nums leading-none ${
            isCompact ? 'text-[11px]' : 'text-sm sm:text-base'
          }`}
        >
          {/* Row 1: VEL | RES */}
          <div className="flex items-center justify-center gap-1.5">
            <span style={{ color: vis.textPrimary }} className="font-extrabold">
              {stats.VEL}
            </span>
            <span style={{ color: vis.textSecondary }} className="font-semibold">
              VEL
            </span>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <span style={{ color: vis.textPrimary }} className="font-extrabold">
              {stats.RES}
            </span>
            <span style={{ color: vis.textSecondary }} className="font-semibold">
              RES
            </span>
          </div>

          {/* Row 2: TIR | DIF */}
          <div className="flex items-center justify-center gap-1.5">
            <span style={{ color: vis.textPrimary }} className="font-extrabold">
              {stats.TIR}
            </span>
            <span style={{ color: vis.textSecondary }} className="font-semibold">
              TIR
            </span>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <span style={{ color: vis.textPrimary }} className="font-extrabold">
              {stats.DIF}
            </span>
            <span style={{ color: vis.textSecondary }} className="font-semibold">
              DIF
            </span>
          </div>

          {/* Row 3: PAS | POR */}
          <div className="flex items-center justify-center gap-1.5">
            <span style={{ color: vis.textPrimary }} className="font-extrabold">
              {stats.PAS}
            </span>
            <span style={{ color: vis.textSecondary }} className="font-semibold">
              PAS
            </span>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <span style={{ color: vis.textPrimary }} className="font-extrabold">
              {stats.POR}
            </span>
            <span style={{ color: vis.textSecondary }} className="font-semibold">
              POR
            </span>
          </div>
        </div>
      </div>
    </Wrapper>
  );
};

/**
 * SVG Pentagon Radar Chart for the 5 Outfield Fundamentals
 */
const PentagonRadar: React.FC<{ weights: Player['weights'] }> = ({ weights }) => {
  const keys: Array<{ key: keyof Player['weights']; label: string }> = [
    { key: 'tiro', label: 'TIR' },
    { key: 'velocita', label: 'VEL' },
    { key: 'passaggio', label: 'PAS' },
    { key: 'resistenza', label: 'RES' },
    { key: 'difesa', label: 'DIF' },
  ];

  const cx = 110;
  const cy = 110;
  const radius = 72;

  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / 5 - Math.PI / 2;
    const r = radius * value;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  const rings = [0.25, 0.5, 0.75, 1.0];
  const dataPoints = keys.map((k, idx) =>
    getPoint(idx, Math.max(0.1, weights[k.key]))
  );
  const polygonPoints = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg viewBox="0 0 220 220" className="w-full max-w-[220px] mx-auto">
      {/* Concentric Pentagons */}
      {rings.map((r) => {
        const pts = keys
          .map((_, idx) => {
            const p = getPoint(idx, r);
            return `${p.x},${p.y}`;
          })
          .join(' ');
        return (
          <polygon
            key={r}
            points={pts}
            fill="none"
            stroke="rgba(148, 163, 184, 0.2)"
            strokeWidth="1"
          />
        );
      })}

      {/* Axes */}
      {keys.map((k, idx) => {
        const end = getPoint(idx, 1.0);
        const labelPos = getPoint(idx, 1.24);
        return (
          <g key={k.key}>
            <line
              x1={cx}
              y1={cy}
              x2={end.x}
              y2={end.y}
              stroke="rgba(148, 163, 184, 0.2)"
              strokeWidth="1"
            />
            <text
              x={labelPos.x}
              y={labelPos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-slate-300 text-[10px] font-mono-tabular font-semibold"
            >
              {k.label} {weightToFutStat(weights[k.key])}
            </text>
          </g>
        );
      })}

      {/* Player Polygon */}
      <polygon
        points={polygonPoints}
        fill="rgba(16, 185, 129, 0.28)"
        stroke="#10b981"
        strokeWidth="2"
      />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#34d399" />
      ))}
    </svg>
  );
};

const ROLE_FULL_NAME: Record<string, string> = {
  POR: 'Portiere',
  DIF: 'Difensore',
  TUT: 'Tuttocampista',
  ATT: 'Attaccante',
};

export const FutCardDetailModal: React.FC<{
  player: Player | null;
  onClose: () => void;
}> = ({ player, onClose }) => {
  const { config } = useApp();
  if (!player) return null;

  const metrics = computePlayerMetrics(
    player.weights,
    player.wants_to_be_gk,
    config
  );
  const tau = config.role_threshold_tau;
  const deltaPercent = ((metrics.delta_i + 1) / 2) * 100;
  const tauLeftPercent = ((-tau + 1) / 2) * 100;
  const tauRightPercent = ((tau + 1) / 2) * 100;

  const activeRoleCode = player.wants_to_be_gk ? 'POR' : player.computed.role_label;
  const activeRoleTitle = ROLE_FULL_NAME[activeRoleCode] ?? activeRoleCode;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Player Card ${player.name}`}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-2xl font-display font-bold text-white tracking-wide">
              Player Card — {player.name}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Valori ufficiali FUT (40–99) · {player.stats.matches_played} presenze complessive
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi scheda giocatore"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-5 items-center">
          <div className="md:col-span-5 flex justify-center">
            <div className="w-56">
              <FutCard player={player} />
            </div>
          </div>

          <div className="md:col-span-7 space-y-4">
            <PentagonRadar weights={player.weights} />

            {/* Clean Tactical Role Bar (Without math formulas or (-1.0)/(+1.0)) */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
                <span className="flex items-center gap-1 font-medium text-sky-400">
                  <Shield className="w-3.5 h-3.5" /> Difensore
                </span>
                <span className="font-semibold text-white">
                  Ruolo: {activeRoleTitle}
                </span>
                <span className="flex items-center gap-1 font-medium text-rose-400">
                  Attaccante <Crosshair className="w-3.5 h-3.5" />
                </span>
              </div>

              <div className="relative h-3 rounded-full bg-slate-800 overflow-hidden">
                {/* Neutral TUT Zone */}
                <div
                  className="absolute top-0 bottom-0 bg-amber-500/20 border-x border-amber-400/40"
                  style={{
                    left: `${tauLeftPercent}%`,
                    width: `${tauRightPercent - tauLeftPercent}%`,
                  }}
                />
                {/* Marker */}
                <div
                  className="absolute top-0 bottom-0 w-2.5 -ml-1.25 rounded-full bg-emerald-400 shadow"
                  style={{ left: `${deltaPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                <span>Propensione Difensiva</span>
                <span>Tuttocampista</span>
                <span>Propensione Offensiva</span>
              </div>
            </div>
          </div>
        </div>

        {/* Clean FUT Stats and Historical Vote Counts (Zero [0,1] or math symbols) */}
        <div className="mt-6 pt-4 border-t border-slate-800">
          <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-400" /> Valori FUT e Voti Storici Ricevuti
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            {(
              [
                ['tiro', 'Tiro'],
                ['velocita', 'Velocità'],
                ['passaggio', 'Passaggio'],
                ['resistenza', 'Resistenza'],
                ['difesa', 'Difesa'],
                ['portiere', 'Portiere'],
              ] as const
            ).map(([key, label]) => (
              <div
                key={key}
                className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between"
              >
                <span className="text-slate-400 font-medium">{label}</span>
                <div className="flex items-baseline justify-between mt-1 font-mono-tabular">
                  <span className="text-lg font-display font-extrabold text-emerald-400">
                    FUT {weightToFutStat(player.weights[key])}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 font-mono-tabular">
                  {player.attr_votes_count[key] ?? 0} voti ricevuti
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
