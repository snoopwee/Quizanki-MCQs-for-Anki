import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">AnkiQuiz</h1>
      <p className="max-w-md text-center text-neutral-500">
        Turn your Anki decks into multiple-choice quizzes. Free, fast, and
        Anki-native.
      </p>
      <div className="flex gap-3">
        <Link
          href="/auth/login"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          Log in
        </Link>
        <Link
          href="/auth/signup"
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Sign up
        </Link>
      </div>
    </main>
  );
}
