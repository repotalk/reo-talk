import React, { useRef, useEffect, useState, useCallback } from "react";

// Main App component for the voice-reactive waveform
const App = () => {
  // useRef to get a direct reference to the canvas DOM element
  const canvasRef = useRef(null);
  // useState to store microphone access status
  const [micAllowed, setMicAllowed] = useState(false);
  // useState to store error messages, if any
  const [error, setError] = useState(null);
  // useRef for audio context and analyser node, to persist across renders
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null); // To store frequency data

  // useRef for the spiral accent's rotation phase, to avoid re-renders
  const spiralRotationPhaseRef1 = useRef(0); // Phase for the first spiral
  const spiralRotationPhaseRef2 = useRef(0); // Phase for the second spiral

  // Function to initialize canvas dimensions
  const initializeCanvasDimensions = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    }
  }, []);

  // Effect to set up Web Audio API and microphone access
  useEffect(() => {
    const setupAudio = async () => {
      try {
        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

        // Create AudioContext and connect stream
        audioContextRef.current = new (window.AudioContext ||
          window.webkitAudioContext)();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        analyserRef.current = audioContextRef.current.createAnalyser();

        // Configure analyser node
        analyserRef.current.fftSize = 256; // Fast Fourier Transform size
        dataArrayRef.current = new Uint8Array(
          analyserRef.current.frequencyBinCount
        );

        // Connect nodes: source -> analyser -> destination (speakers, but not strictly needed for visualization)
        source.connect(analyserRef.current);
        // analyserRef.current.connect(audioContextRef.current.destination); // Optional: connect to speakers

        setMicAllowed(true); // Microphone access granted
      } catch (err) {
        console.error("Error accessing microphone:", err);
        setError(
          "Microphone access denied or not available. Please allow microphone access to enable voice reactivity."
        );
        setMicAllowed(false);
      }
    };

    setupAudio();

    // Cleanup function for audio context
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current
          .close()
          .catch((e) => console.error("Error closing audio context:", e));
      }
    };
  }, []); // Run only once on component mount

  // Function to draw the waveform based on audio data
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate center and base radius
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Define inner and outer radii for the concentric circles
    const innerRadius = Math.min(canvas.width, canvas.height) * 0.1;
    const outerRadius = Math.min(canvas.width, canvas.height) * 0.45;

    let currentVoiceAmplitude = 0;
    if (micAllowed && analyser && dataArray) {
      // Get frequency data from the analyser
      analyser.getByteFrequencyData(dataArray);

      // Calculate an average amplitude from a portion of the frequency data
      let sum = 0;
      const sliceLength = Math.floor(dataArray.length / 4);
      for (let i = 0; i < sliceLength; i++) {
        sum += dataArray[i];
      }
      currentVoiceAmplitude = sum / sliceLength / 255; // Normalized 0-1
      currentVoiceAmplitude = Math.max(currentVoiceAmplitude, 0.02); // Small base for visual presence
    } else {
      currentVoiceAmplitude = 0.02; // Default small presence if no mic or silent
    }

    // Colors for interpolation (approximated from the provided image)
    const colorReddishOrange = { r: 200, g: 100, b: 70 }; // Warm reddish-orange
    const colorCoolGreen = { r: 70, g: 180, b: 100 }; // Cool green

    const numCircles = 15; // Number of concentric circles
    const dotsPerCircle = 80; // Number of dots per circle (controls spacing)

    // Dot size properties for the donut effect
    const donutMinDotSize = 1; // Size at the very inner/outer edges of the donut
    const donutMaxDotSize = 5; // Max size at the "middle" of the donut's radial range
    const voiceDotScaleFactor = 2; // How much voice amplitude scales the dot size

    // --- Draw First Subtle Spiral Accent ---
    ctx.save(); // Save current canvas state
    ctx.strokeStyle = "rgba(100, 255, 255, 0.2)"; // Slightly more opaque cyan
    ctx.lineWidth = 0.8; // Slightly thicker line

    const accentSpiralRevolutions1 = 1.5; // How many times the spiral wraps
    const accentSpiralPoints1 = 200; // For smoothness of the spiral line
    const accentSpiralMaxRadius1 = Math.min(canvas.width, canvas.height) * 0.4; // Max radius for the accent spiral

    ctx.beginPath();
    for (let k = 0; k <= accentSpiralPoints1; k++) {
      const normalizedK = k / accentSpiralPoints1;
      // Angle increases with progress and current rotation phase
      const currentAngle =
        normalizedK * Math.PI * 2 * accentSpiralRevolutions1 +
        spiralRotationPhaseRef1.current;
      // Radius increases with progress, staying within the main donut area
      const currentRadius =
        innerRadius + (accentSpiralMaxRadius1 - innerRadius) * normalizedK;

      const x = centerX + currentRadius * Math.cos(currentAngle);
      const y = centerY + currentRadius * Math.sin(currentAngle);

      if (k === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.restore(); // Restore canvas state

    // --- Draw Second Subtle Spiral Accent ---
    ctx.save(); // Save current canvas state for the second spiral
    ctx.strokeStyle = "rgba(255, 150, 150, 0.15)"; // Faint reddish hue
    ctx.lineWidth = 0.6; // Slightly thinner than the first

    const accentSpiralRevolutions2 = 2.0; // More revolutions for a denser spiral
    const accentSpiralPoints2 = 250; // More points for smoothness
    const accentSpiralMaxRadius2 = Math.min(canvas.width, canvas.height) * 0.35; // Slightly smaller max radius

    ctx.beginPath();
    for (let k = 0; k <= accentSpiralPoints2; k++) {
      const normalizedK = k / accentSpiralPoints2;
      // Angle increases with progress and current rotation phase (different ref)
      const currentAngle =
        normalizedK * Math.PI * 2 * accentSpiralRevolutions2 +
        spiralRotationPhaseRef2.current;
      // Radius increases with progress
      const currentRadius =
        innerRadius + (accentSpiralMaxRadius2 - innerRadius) * normalizedK;

      const x = centerX + currentRadius * Math.cos(currentAngle);
      const y = centerY + currentRadius * Math.sin(currentAngle);

      if (k === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.restore(); // Restore canvas state

    // Draw each concentric circle as a series of dots
    for (let i = 0; i < numCircles; i++) {
      // Linear spacing
      const normalizedProgress = i / (numCircles - 1);

      // Calculate the radius for the current circle
      const radius =
        innerRadius + (outerRadius - innerRadius) * normalizedProgress;

      // Voice reactivity: make circles slightly larger/thicker with voice
      const voiceEffectRadius = radius * (1 + currentVoiceAmplitude * 0.1); // Subtle radial expansion

      // Calculate base dot size for the donut effect: largest in the middle of the radial range
      const radialMidPoint = 0.5;
      const distanceToMid = Math.abs(normalizedProgress - radialMidPoint);
      // This factor will be 1 at midpoint, and decrease towards 0 at 0 and 1
      const sizeCurveFactor = 1 - distanceToMid * 2;
      const baseDotSize =
        donutMinDotSize + sizeCurveFactor * (donutMaxDotSize - donutMinDotSize);

      // Apply voice reactivity to this base size
      const dotSize =
        baseDotSize * (1 + currentVoiceAmplitude * voiceDotScaleFactor);

      // Calculate alpha based on normalizedProgress (closer to center means lower alpha)
      // Using a power function to make the fade more pronounced near the center
      const alpha = Math.pow(normalizedProgress, 0.8); // Adjust exponent for desired fade curve

      for (let j = 0; j < dotsPerCircle; j++) {
        const angle = (j / dotsPerCircle) * Math.PI * 2; // Angle for the current dot

        // Calculate color based on angle for left-to-right transition
        const colorMix = (Math.cos(angle) + 1) / 2; // 0 at PI (left), 1 at 0/2PI (right)

        const r = Math.round(
          colorReddishOrange.r * (1 - colorMix) + colorCoolGreen.r * colorMix
        );
        const g = Math.round(
          colorReddishOrange.g * (1 - colorMix) + colorCoolGreen.g * colorMix
        );
        const b = Math.round(
          colorReddishOrange.b * (1 - colorMix) + colorCoolGreen.b * colorMix
        );

        // Set fillStyle with calculated RGB and dynamic alpha
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;

        // Convert polar coordinates (radius, angle) to Cartesian coordinates (x, y)
        const x = centerX + voiceEffectRadius * Math.cos(angle);
        const y = centerY + voiceEffectRadius * Math.sin(angle);

        // Draw the square dot
        ctx.fillRect(x - dotSize / 2, y - dotSize / 2, dotSize, dotSize);
      }
    }
  }, [micAllowed]); // Redraw function depends on micAllowed state

  // Effect for the animation loop
  useEffect(() => {
    initializeCanvasDimensions(); // Initial dimensions
    window.addEventListener("resize", initializeCanvasDimensions); // Handle resize

    let animationFrameId;

    const animate = () => {
      // Update the spiral accent's rotation phases
      spiralRotationPhaseRef1.current += 0.005; // Adjust speed as needed for first spiral
      spiralRotationPhaseRef2.current -= 0.003; // Different speed and direction for second spiral
      drawWaveform();
      animationFrameId = requestAnimationFrame(animate);
    };

    animate(); // Start the animation loop

    // Cleanup function for animation frame and resize listener
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", initializeCanvasDimensions);
    };
  }, [drawWaveform, initializeCanvasDimensions]); // Re-run if drawWaveform or initializeCanvasDimensions changes

  return (
    <div
      className="
            flex flex-col items-center justify-center min-h-screen
            bg-black text-white
            p-4 sm:p-6 md:p-8 lg:p-10
        "
    >
      <div
        className="
                canvas-container
                bg-black border border-blue-800 rounded-lg shadow-2xl shadow-cyan-500/50
                p-6 sm:p-8 md:p-10 lg:p-12
                w-full max-w-4xl
                flex flex-col items-center
            "
      >
        <h1
          className="
                    text-cyan-400 text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6
                    text-shadow-glow
                "
        >
          reo
        </h1>
        {error && (
          <p className="text-red-400 text-center mb-4 p-2 bg-red-900 bg-opacity-30 rounded-md">
            {error}
          </p>
        )}
        {!micAllowed && !error && (
          <p className="text-yellow-400 text-center mb-4 p-2 bg-yellow-900 bg-opacity-30 rounded-md">
            Please allow microphone access in your browser to enable voice
            reactivity.
          </p>
        )}
        <canvas
          ref={canvasRef}
          className="
                        bg-black
                        w-full h-[500px] sm:h-[600px] md:h-[700px] lg:h-[800px]
                    "
        ></canvas>
      </div>
    </div>
  );
};

export default App;
