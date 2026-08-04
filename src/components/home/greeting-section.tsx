/**
 * Home page greeting. Static for now — a personalized "Welcome back, {name}"
 * lands once user profiles are read (Slice 3+ API layer).
 */
export function GreetingSection() {
  return (
    <section aria-labelledby="greeting-heading">
      <h1
        id="greeting-heading"
        className="text-3xl font-bold tracking-tight"
      >
        Welcome back
      </h1>
    </section>
  );
}