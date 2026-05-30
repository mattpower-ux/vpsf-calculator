export default function App() {
  return (
    <main style={{
      minHeight: "100vh",
      background: "#071827",
      color: "white",
      fontFamily: "Arial, sans-serif",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px"
    }}>
      <section style={{
        maxWidth: "460px",
        background: "#0f2740",
        borderRadius: "28px",
        padding: "32px",
        boxShadow: "0 24px 80px rgba(0,0,0,.35)"
      }}>
        <p style={{ color: "#72d6ff", fontWeight: 700 }}>
          COGNITION SmartData
        </p>

        <h1 style={{ fontSize: "36px", lineHeight: 1.05 }}>
          Value Per Square Foot Calculator
        </h1>

        <p style={{ color: "#c9d7e6", lineHeight: 1.5 }}>
          A prototype interface for scoring homes across energy, water,
          health, resilience, carbon, financial risk, and community value.
        </p>

        <button style={{
          width: "100%",
          marginTop: "24px",
          padding: "16px",
          borderRadius: "16px",
          border: "0",
          background: "#27b7ff",
          color: "#06131f",
          fontWeight: 800,
          fontSize: "16px"
        }}>
          Start VPSF Evaluation
        </button>
      </section>
    </main>
  );
}
