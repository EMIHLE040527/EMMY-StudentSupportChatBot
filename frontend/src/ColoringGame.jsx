
import { useEffect, useRef, useState } from "react";
import "./ColoringGame.css";

const SIZE = 700;
const SAVE_KEY = "emmyAdultColoringGame";

const STAGES = [
  "Beach Walk",
  "Ocean View",
  "Cozy House",
  "Neighborhood Street",
  "Dog and Owner in the Park",
  "Couple Walking by the Sea",
  "Cafe Corner",
  "Mountain Cabin",
  "City Skyline",
  "Study Desk Scene",
  "Garden Patio",
  "Harbour Sunset"
];

const COLORS = [
  "#ef4444",
  "#f97316",
  "#facc15",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#38bdf8",
  "#2563eb",
  "#8b5cf6",
  "#d946ef",
  "#ec4899",
  "#92400e",
  "#111827",
  "#ffffff"
];

function formatTime(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;

  return (
    String(minutes).padStart(2, "0") +
    ":" +
    String(secs).padStart(2, "0")
  );
}

function readSaved() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(SAVE_KEY) || "{}"
    );

    const stage = Math.min(
      STAGES.length - 1,
      Math.max(0, Number(saved.stage) || 0)
    );

    const unlocked = Math.min(
      STAGES.length - 1,
      Math.max(stage, Number(saved.unlocked) || 0)
    );

    return {
      stage,
      unlocked,
      drawings: saved.drawings || {}
    };
  } catch {
    return {
      stage: 0,
      unlocked: 0,
      drawings: {}
    };
  }
}

function drawStroke(ctx, stroke) {
  if (!stroke.points?.length) return;

  ctx.save();

  ctx.lineWidth = stroke.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;

  ctx.globalCompositeOperation =
    stroke.tool === "eraser"
      ? "destination-out"
      : "source-over";

  const points = stroke.points;

  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(
      points[0].x,
      points[0].y,
      stroke.size / 2,
      0,
      Math.PI * 2
    );
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }

    ctx.stroke();
  }

  ctx.restore();
}

/* ===============================
   COLORING SCENE COMPONENTS
   =============================== */

function Cloud({ x, y, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M -45 15 Q -60 -10 -35 -22 Q -25 -48 0 -36 Q 30 -52 42 -20 Q 68 -20 65 8 Q 57 25 38 20 H -24 Q -40 25 -45 15 Z" />
    </g>
  );
}

function Sun({ x, y }) {
  return (
    <g>
      <circle cx={x} cy={y} r="31" />
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i * Math.PI) / 6;

        return (
          <line
            key={i}
            x1={x + Math.cos(angle) * 41}
            y1={y + Math.sin(angle) * 41}
            x2={x + Math.cos(angle) * 62}
            y2={y + Math.sin(angle) * 62}
          />
        );
      })}
    </g>
  );
}

function Tree({ x, y, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M -12 0 V -90 H 12 V 0" />
      <path d="M -15 -55 Q -85 -55 -66 -109 Q -95 -158 -42 -174 Q -10 -220 38 -178 Q 91 -180 75 -125 Q 102 -72 40 -61 Q 8 -38 -15 -55 Z" />
      <path d="M 0 -85 L -36 -120 M 0 -100 L 42 -145" />
    </g>
  );
}

function House({ x, y, width = 150, height = 150 }) {
  return (
    <g>
      <path
        d={`M ${x - 15} ${y} L ${x + width / 2} ${y - 90} L ${x + width + 15} ${y} Z`}
      />

      <rect x={x} y={y} width={width} height={height} />

      <rect
        x={x + width * 0.4}
        y={y + height * 0.5}
        width={width * 0.22}
        height={height * 0.5}
      />

      <circle
        cx={x + width * 0.56}
        cy={y + height * 0.77}
        r="3"
      />

      {[0.12, 0.7].map((fraction, index) => (
        <g key={index}>
          <rect
            x={x + width * fraction}
            y={y + 25}
            width={width * 0.18}
            height="39"
          />

          <line
            x1={x + width * (fraction + 0.09)}
            y1={y + 25}
            x2={x + width * (fraction + 0.09)}
            y2={y + 64}
          />

          <line
            x1={x + width * fraction}
            y1={y + 44}
            x2={x + width * (fraction + 0.18)}
            y2={y + 44}
          />
        </g>
      ))}

      <path d={`M ${x + 10} ${y - 20} H ${x + width - 10}`} />
    </g>
  );
}

function Person({ x, y, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <circle cx="0" cy="0" r="17" />
      <path d="M -13 18 Q -23 40 -18 83 H 19 Q 23 40 13 18 Z" />
      <path d="M -17 34 L -37 69 M 18 34 L 37 69" />
      <path d="M -10 83 L -19 137 M 10 83 L 20 137" />
      <path d="M -19 137 H -30 M 20 137 H 31" />
    </g>
  );
}

function Dog({ x, y, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="23" cy="8" rx="44" ry="23" />
      <circle cx="-22" cy="-5" r="19" />
      <path d="M -34 -18 L -46 -39 L -29 -30" />
      <path d="M -18 -22 L -9 -38 L -4 -17" />
      <circle cx="-32" cy="-8" r="3" />
      <path d="M -40 6 Q -30 17 -20 8" />
      <path d="M -10 26 L -12 65 H -2 L 4 27" />
      <path d="M 22 27 L 21 66 H 32 L 37 25" />
      <path d="M 53 22 L 52 65 H 64 L 67 18" />
      <path d="M 64 -1 Q 98 -40 96 -7" />
      <path d="M -11 12 H 2" />
    </g>
  );
}

function Boat({ x, y, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M 0 0 H 120 L 95 35 H 25 Z" />
      <path d="M 53 0 V -120" />
      <path d="M 53 -110 V -7 H 116 Z" />
      <path d="M 48 -97 L 48 -8 H 3 Z" />
      <path d="M 25 15 H 90" />
    </g>
  );
}

function Building({ x, y, width, height }) {
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} />

      {Array.from(
        { length: Math.floor((height - 30) / 43) },
        (_, row) =>
          Array.from(
            { length: Math.floor((width - 12) / 30) },
            (_, col) => (
              <rect
                key={`${row}-${col}`}
                x={x + 13 + col * 30}
                y={y + 15 + row * 43}
                width="17"
                height="24"
              />
            )
          )
      )}

      <path d={`M ${x - 6} ${y} H ${x + width + 6}`} />
    </g>
  );
}

function Waves({ start = 310, count = 7 }) {
  return (
    <g>
      {Array.from({ length: count }, (_, i) => (
        <path
          key={i}
          d={`M 0 ${start + i * 42}
            Q 90 ${start + i * 42 - 18}
            180 ${start + i * 42}
            T 360 ${start + i * 42}
            T 540 ${start + i * 42}
            T 720 ${start + i * 42}`}
        />
      ))}
    </g>
  );
}

function Bench({ x, y }) {
  return (
    <g>
      <rect x={x} y={y} width="125" height="13" />
      <rect x={x + 7} y={y - 42} width="110" height="20" />
      <path d={`M ${x + 15} ${y + 13} L ${x + 8} ${y + 60}`} />
      <path d={`M ${x + 110} ${y + 13} L ${x + 117} ${y + 60}`} />
    </g>
  );
}

function Flower({ x, y, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {Array.from({ length: 8 }, (_, i) => (
        <ellipse
          key={i}
          cx="0"
          cy="-22"
          rx="12"
          ry="26"
          transform={`rotate(${i * 45} 0 0)`}
        />
      ))}

      <circle cx="0" cy="0" r="13" />
      <path d="M 0 40 Q -10 65 0 110" />
      <path d="M -3 78 Q -48 42 -45 82 Q -25 100 -3 78" />
      <path d="M 3 93 Q 45 55 48 92 Q 30 111 3 93" />
    </g>
  );
}

/* ===============================
   ALL 12 COLORING SCENES
   =============================== */

function SceneArtwork({ stage }) {
  return (
    <svg
      className="cg-outline"
      viewBox="0 0 700 700"
      aria-hidden="true"
    >
      {stage === 0 && (
        <g>
          <Sun x={105} y={106} />
          <Cloud x={483} y={112} />
          <Waves start={380} count={5} />
          <path d="M 0 520 Q 250 490 700 530" />
          <path d="M 270 700 Q 290 610 360 550" />
          <path d="M 430 700 Q 410 610 360 550" />
          <path d="M 40 630 Q 130 600 220 630" />
          <path d="M 465 640 Q 565 605 670 630" />
          <path d="M 100 570 Q 130 540 160 570" />
          <path d="M 520 565 Q 550 535 580 565" />
          <path d="M 590 600 Q 615 580 640 605" />
          <path d="M 90 690 Q 120 650 160 690" />
        </g>
      )}

      {stage === 1 && (
        <g>
          <Cloud x={95} y={95} />
          <Cloud x={510} y={115} scale={0.8} />
          <Sun x={358} y={124} />
          <Waves start={280} count={9} />
          <Boat x={100} y={405} scale={1.2} />
          <Boat x={480} y={355} scale={0.65} />
          <path d="M 0 580 Q 200 550 350 580 T 700 580" />
          <path d="M 45 630 Q 130 610 215 630" />
          <path d="M 380 648 Q 510 615 640 650" />
          <circle cx="390" cy="490" r="19" />
          <circle cx="417" cy="505" r="12" />
          <circle cx="365" cy="515" r="8" />
        </g>
      )}

      {stage === 2 && (
        <g>
          <Sun x={570} y={102} />
          <Cloud x={75} y={95} />
          <House x={240} y={270} width={220} height={195} />
          <Tree x={145} y={460} scale={1.2} />
          <Tree x={566} y={455} scale={1.15} />
          <path d="M 0 510 H 700" />
          <path d="M 320 465 Q 300 570 240 700" />
          <path d="M 380 465 Q 410 570 465 700" />
          <path d="M 0 600 Q 110 560 230 600" />
          <path d="M 470 600 Q 600 550 700 590" />
          <Flower x={100} y={620} scale={0.65} />
          <Flower x={605} y={625} scale={0.65} />
        </g>
      )}

      {stage === 3 && (
        <g>
          <Cloud x={65} y={90} />
          <Cloud x={505} y={110} />
          <House x={45} y={270} width={125} height={125} />
          <House x={200} y={245} width={140} height={150} />
          <House x={382} y={275} width={130} height={120} />
          <House x={545} y={260} width={110} height={135} />
          <Tree x={177} y={453} scale={0.78} />
          <Tree x={520} y={455} scale={0.75} />
          <path d="M 0 475 H 700" />
          <path d="M 0 530 Q 350 555 700 530" />
          <path d="M 0 625 Q 350 650 700 625" />
          <path d="M 100 575 H 185" />
          <path d="M 270 585 H 350" />
          <path d="M 450 578 H 530" />
          <path d="M 80 440 H 615" />
        </g>
      )}

      {stage === 4 && (
        <g>
          <Cloud x={90} y={90} />
          <Sun x={590} y={100} />
          <Tree x={118} y={430} scale={1.25} />
          <Tree x={580} y={430} scale={1.15} />
          <Bench x={75} y={530} />
          <Person x={340} y={355} scale={1.4} />
          <Dog x={442} y={503} scale={1.1} />
          <path d="M 370 406 Q 425 405 432 485" />
          <path d="M 0 600 H 700" />
          <path d="M 0 660 Q 350 610 700 660" />
          <Flower x={230} y={580} scale={0.55} />
          <Flower x={630} y={600} scale={0.5} />
        </g>
      )}

      {stage === 5 && (
        <g>
          <Sun x={555} y={120} />
          <Cloud x={100} y={95} />
          <Waves start={280} count={4} />
          <path d="M 0 475 H 700" />
          <path d="M 0 520 H 700" />
          <path d="M 0 570 H 700" />
          <Person x={308} y={360} scale={1.25} />
          <Person x={396} y={350} scale={1.3} />
          <path d="M 332 396 L 373 395" />
          <Boat x={85} y={360} scale={0.9} />
          <Boat x={520} y={390} scale={0.75} />
          <path d="M 0 635 Q 350 600 700 635" />
          <path d="M 0 680 Q 350 645 700 680" />
        </g>
      )}

      {stage === 6 && (
        <g>
          <rect x="100" y="165" width="500" height="400" />
          <path d="M 110 165 V 115 H 590 V 165" />
          <path d="M 100 190 H 600" />
          <rect x="165" y="240" width="170" height="155" />
          <rect x="415" y="240" width="120" height="240" />
          <path d="M 250 240 V 395" />
          <path d="M 165 315 H 335" />
          <circle cx="470" cy="420" r="6" />
          <rect x="175" y="490" width="125" height="14" />
          <path d="M 190 504 L 180 565" />
          <path d="M 285 504 L 300 565" />
          <circle cx="475" cy="530" r="42" />
          <path d="M 433 530 H 517" />
          <path d="M 475 488 V 572" />
          <Flower x={366} y={490} scale={0.53} />
          <path d="M 100 610 H 600" />
          <path d="M 135 630 H 565" />
        </g>
      )}

      {stage === 7 && (
        <g>
          <path d="M 0 320 L 125 145 L 250 320" />
          <path d="M 135 310 L 335 85 L 530 310" />
          <path d="M 405 320 L 560 130 L 700 320" />
          <House x={255} y={375} width={190} height={140} />
          <Tree x={130} y={520} scale={1.1} />
          <Tree x={555} y={510} scale={1.25} />
          <Tree x={645} y={535} scale={0.7} />
          <path d="M 0 540 H 700" />
          <path d="M 320 515 Q 310 600 260 700" />
          <path d="M 385 515 Q 420 610 465 700" />
          <path d="M 0 635 Q 160 585 260 620" />
          <path d="M 460 615 Q 590 570 700 620" />
        </g>
      )}

      {stage === 8 && (
        <g>
          <Cloud x={110} y={92} />
          <Cloud x={520} y={80} scale={0.85} />
          <Building x={30} y={270} width={85} height={265} />
          <Building x={115} y={195} width={125} height={340} />
          <Building x={240} y={260} width={90} height={275} />
          <Building x={330} y={145} width={145} height={390} />
          <Building x={475} y={225} width={100} height={310} />
          <Building x={575} y={185} width={95} height={350} />
          <path d="M 0 535 H 700" />
          <path d="M 170 535 V 700" />
          <path d="M 535 535 V 700" />
          <path d="M 0 620 H 700" />
          <path d="M 0 665 H 700" />
          <path d="M 285 580 H 415" />
        </g>
      )}

      {stage === 9 && (
        <g>
          <rect x="130" y="490" width="460" height="25" />
          <path d="M 165 515 L 150 650" />
          <path d="M 555 515 L 570 650" />
          <rect x="225" y="305" width="260" height="165" rx="8" />
          <path d="M 205 475 H 505" />
          <path d="M 315 475 V 490 H 385 V 475" />
          <rect x="135" y="320" width="58" height="140" />
          <path d="M 145 350 H 183" />
          <path d="M 145 380 H 183" />
          <path d="M 145 410 H 183" />
          <rect x="520" y="400" width="65" height="85" />
          <path d="M 552 400 V 340" />
          <path d="M 520 340 Q 552 285 585 340 Z" />
          <circle cx="550" cy="445" r="18" />
          <path d="M 530 445 H 570" />
          <rect x="265" y="205" width="75" height="33" />
          <rect x="365" y="195" width="110" height="43" />
          <path d="M 275 220 H 330" />
          <path d="M 380 210 H 460" />
          <path d="M 380 223 H 445" />
          <path d="M 115 650 H 605" />
        </g>
      )}

      {stage === 10 && (
        <g>
          <path d="M 0 560 H 700" />
          <rect x="230" y="450" width="230" height="18" />
          <path d="M 255 468 L 243 540" />
          <path d="M 435 468 L 448 540" />
          <circle cx="345" cy="365" r="77" />
          <path d="M 345 288 V 442" />
          <path d="M 268 365 H 422" />
          <path d="M 290 310 L 400 420" />
          <path d="M 400 310 L 290 420" />
          <Tree x={115} y={460} scale={0.85} />
          <Tree x={595} y={460} scale={0.85} />
          <Bench x={60} y={540} />
          <Flower x={510} y={565} scale={0.75} />
          <Flower x={575} y={600} scale={0.55} />
          <Flower x={140} y={625} scale={0.6} />
          <path d="M 0 230 Q 180 200 360 230 T 700 230" />
        </g>
      )}

      {stage === 11 && (
        <g>
          <Sun x={560} y={115} />
          <Cloud x={90} y={100} />
          <Waves start={240} count={9} />
          <Boat x={95} y={420} scale={1.05} />
          <Boat x={465} y={385} scale={0.85} />
          <House x={345} y={480} width={115} height={100} />
          <House x={545} y={465} width={115} height={115} />
          <path d="M 0 590 H 700" />
          <path d="M 0 635 H 700" />

          {Array.from({ length: 12 }, (_, i) => (
            <line
              key={i}
              x1={i * 60}
              y1="590"
              x2={i * 60}
              y2="635"
            />
          ))}

          <path d="M 0 675 H 700" />
          <path d="M 180 625 L 155 700" />
          <path d="M 490 625 L 515 700" />
        </g>
      )}
    </svg>
  );
}

/* ===============================
   MAIN COLORING GAME
   =============================== */

export default function ColoringGame({
  durationMinutes = 5,
  onFinish
}) {
  const [saved, setSaved] = useState(readSaved);

  const [started, setStarted] = useState(false);

  const [color, setColor] = useState("#8b5cf6");
  const [brushSize, setBrushSize] = useState(16);
  const [tool, setTool] = useState("brush");

  const [secondsLeft, setSecondsLeft] = useState(
    () => Math.max(1, Number(durationMinutes) || 5) * 60
  );

  const gameEndRef = useRef(null);
  const canvasRef = useRef(null);

  const drawingRef = useRef(false);
  const currentStrokeRef = useRef(null);

  const endCalledRef = useRef(false);
  const onFinishRef = useRef(onFinish);

  const strokes = saved.drawings[saved.stage] || [];

  const warning =
    started && secondsLeft > 0 && secondsLeft <= 15;

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  // Save colouring progress.
  useEffect(() => {
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify(saved)
      );
    } catch (error) {
      console.error(
        "Unable to save coloring progress:",
        error
      );
    }
  }, [saved]);

  // Countdown only runs after clicking Play Game.
  useEffect(() => {
    if (!started || gameEndRef.current === null) {
      return undefined;
    }

    const updateCountdown = () => {
      const remaining = Math.max(
        0,
        Math.ceil(
          (gameEndRef.current - Date.now()) / 1000
        )
      );

      setSecondsLeft(remaining);

      if (
        remaining === 0 &&
        !endCalledRef.current
      ) {
        endCalledRef.current = true;
        onFinishRef.current?.();
      }
    };

    updateCountdown();

    const interval = setInterval(
      updateCountdown,
      250
    );

    return () => clearInterval(interval);
  }, [started]);

  // Restore saved brush strokes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, SIZE, SIZE);

    strokes.forEach((stroke) => {
      drawStroke(ctx, stroke);
    });
  }, [saved.stage, strokes, started]);

  // Start the game and its timer together.
  const startGame = () => {
    if (started || endCalledRef.current) return;

    const duration = Math.max(
      1,
      Number(durationMinutes) || 5
    );

    gameEndRef.current =
      Date.now() + duration * 60 * 1000;

    setSecondsLeft(duration * 60);
    setStarted(true);
  };

  // Return to studying.
  const finishGame = () => {
    if (endCalledRef.current) return;

    endCalledRef.current = true;
    onFinish?.();
  };

  const getCanvasPoint = (event) => {
    const rect =
      canvasRef.current.getBoundingClientRect();

    return {
      x:
        ((event.clientX - rect.left) / rect.width) *
        SIZE,

      y:
        ((event.clientY - rect.top) / rect.height) *
        SIZE
    };
  };

  const pointerDown = (event) => {
    if (!started || secondsLeft <= 0) return;

    event.preventDefault();

    drawingRef.current = true;

    event.currentTarget.setPointerCapture(
      event.pointerId
    );

    const point = getCanvasPoint(event);

    currentStrokeRef.current = {
      color,
      size: brushSize,
      tool,
      points: [point]
    };

    const ctx =
      canvasRef.current.getContext("2d");

    drawStroke(ctx, currentStrokeRef.current);
  };

  const pointerMove = (event) => {
    if (
      !drawingRef.current ||
      !currentStrokeRef.current
    ) {
      return;
    }

    event.preventDefault();

    const point = getCanvasPoint(event);
    const stroke = currentStrokeRef.current;

    stroke.points.push(point);

    const ctx =
      canvasRef.current.getContext("2d");

    drawStroke(ctx, {
      ...stroke,
      points: stroke.points.slice(-2)
    });
  };

  const pointerUp = () => {
    if (
      !drawingRef.current ||
      !currentStrokeRef.current
    ) {
      return;
    }

    drawingRef.current = false;

    const finishedStroke =
      currentStrokeRef.current;

    currentStrokeRef.current = null;

    setSaved((previous) => ({
      ...previous,
      drawings: {
        ...previous.drawings,
        [previous.stage]: [
          ...(previous.drawings[previous.stage] || []),
          finishedStroke
        ]
      }
    }));
  };

  const undo = () => {
    setSaved((previous) => ({
      ...previous,
      drawings: {
        ...previous.drawings,
        [previous.stage]:
          (previous.drawings[previous.stage] || [])
            .slice(0, -1)
      }
    }));
  };

  const clearPage = () => {
    setSaved((previous) => ({
      ...previous,
      drawings: {
        ...previous.drawings,
        [previous.stage]: []
      }
    }));
  };

  const nextStage = () => {
    if (saved.stage >= STAGES.length - 1) return;

    setSaved((previous) => {
      const next = previous.stage + 1;

      return {
        ...previous,
        stage: next,
        unlocked: Math.max(
          previous.unlocked,
          next
        )
      };
    });
  };

  const selectStage = (index) => {
    if (index > saved.unlocked) return;

    setSaved((previous) => ({
      ...previous,
      stage: index
    }));
  };

  /* ===============================
     WELCOME SCREEN
     =============================== */

  if (!started) {
    return (
      <main className="cg-landing">
        <div className="cg-start-card">
          <div className="cg-big-icon">
            🎨
          </div>

          <h1>Coloring Game</h1>

          <p>
            Take a relaxing study break with
            creative coloring pages, peaceful
            scenery and beautiful illustrations.
          </p>

          <div className="cg-landing-timer">
            <span>Break duration</span>

            <strong>
              {formatTime(secondsLeft)}
            </strong>

            <p
              style={{
                fontSize: "14px",
                marginTop: "10px",
                color: "#64748b"
              }}
            >
              Your countdown will start
              when you click Play Game.
            </p>
          </div>

          <div className="cg-start-actions">
            <button
              type="button"
              onClick={startGame}
            >
              ▶ Play Game
            </button>

            <button
              type="button"
              className="cg-light-btn"
              onClick={finishGame}
            >
              Return to Studying
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* ===============================
     ACTIVE COLORING GAME
     =============================== */

  return (
    <main className="cg-game">
      <aside className="cg-sidebar">
        <div className="cg-brand">
          🎨 Coloring Game
        </div>

        <div className="cg-clock">
          <span>BREAK TIME REMAINING</span>

          <strong>
            {formatTime(secondsLeft)}
          </strong>

          <div className="cg-clock-track">
            <div
              style={{
                width: `${
                  Math.min(
                    100,
                    (
                      secondsLeft /
                      Math.max(
                        1,
                        durationMinutes * 60
                      )
                    ) * 100
                  )
                }%`
              }}
            />
          </div>
        </div>

        {warning && (
          <div
            className="cg-warning"
            role="status"
          >
            ⏳ Only {secondsLeft} seconds left.
            Get ready to return to studying!
          </div>
        )}

        <h3>Coloring Stages</h3>

        <div className="cg-stages">
          {STAGES.map((name, index) => (
            <button
              key={name}
              type="button"
              className={
                saved.stage === index
                  ? "active"
                  : ""
              }
              disabled={
                index > saved.unlocked
              }
              onClick={() =>
                selectStage(index)
              }
            >
              <span>
                {index > saved.unlocked
                  ? "🔒"
                  : "🎨"}
              </span>

              {index + 1}. {name}
            </button>
          ))}
        </div>

        <h3>Drawing Tools</h3>

        <div className="cg-tools">
          <button
            type="button"
            className={
              tool === "brush"
                ? "active"
                : ""
            }
            onClick={() =>
              setTool("brush")
            }
          >
            🖌 Brush
          </button>

          <button
            type="button"
            className={
              tool === "eraser"
                ? "active"
                : ""
            }
            onClick={() =>
              setTool("eraser")
            }
          >
            ◻ Eraser
          </button>
        </div>

        <label className="cg-small-label">
          Brush size: {brushSize}
        </label>

        <input
          type="range"
          min="3"
          max="45"
          value={brushSize}
          onChange={(event) =>
            setBrushSize(
              Number(event.target.value)
            )
          }
        />

        <button
          type="button"
          className="cg-return"
          onClick={finishGame}
        >
          ← Return to Studying
        </button>
      </aside>

      <section className="cg-main">
        <div className="cg-heading">
          <div>
            <span>
              STAGE {saved.stage + 1} OF{" "}
              {STAGES.length}
            </span>

            <h1>
              {STAGES[saved.stage]}
            </h1>

            <p>
              Choose a color and draw freely
              on the illustration.
            </p>
          </div>

          <strong className="cg-main-timer">
            ⏱ {formatTime(secondsLeft)}
          </strong>
        </div>

        {warning && (
          <div className="cg-warning">
            Your break is almost over.
            Get ready to study!
          </div>
        )}

        <div className="cg-canvas-card">
          <div className="cg-paper">
            <canvas
              ref={canvasRef}
              width={SIZE}
              height={SIZE}
              className="cg-drawing-canvas"
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={pointerUp}
              onPointerCancel={pointerUp}
              onPointerLeave={pointerUp}
            />

            <SceneArtwork stage={saved.stage} />
          </div>
        </div>

        <div className="cg-palette-panel">
          <h3>Choose Your Color</h3>

          <div className="cg-palette">
            {COLORS.map((item) => (
              <button
                key={item}
                type="button"
                className={
                  color === item
                    ? "selected"
                    : ""
                }
                style={{
                  backgroundColor: item
                }}
                title={item}
                aria-label={`Select ${item}`}
                onClick={() => {
                  setColor(item);
                  setTool("brush");
                }}
              />
            ))}
          </div>
        </div>

        <div className="cg-bottom-actions">
          <span>
            🖌 {strokes.length} brush strokes
            saved on this page
          </span>

          <div>
            <button
              type="button"
              className="cg-light-btn"
              onClick={undo}
              disabled={!strokes.length}
            >
              ↶ Undo
            </button>

            <button
              type="button"
              className="cg-light-btn"
              onClick={clearPage}
            >
              Clear Page
            </button>

            <button
              type="button"
              onClick={nextStage}
              disabled={
                saved.stage ===
                STAGES.length - 1
              }
            >
              Next Stage →
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
