export function LoginCharacters() {
  return (
    <div className="relative flex h-[420px] w-[520px] items-end justify-center">
      {/* Personagem laranja */}
      <div className="relative z-10 h-52 w-52 rounded-t-full bg-orange-500">
        <div className="absolute left-16 top-16 flex gap-8">
          <div className="h-5 w-5 rounded-full bg-black" />
          <div className="h-5 w-5 rounded-full bg-black" />
        </div>
      </div>

      {/* Personagem roxo */}
      <div className="relative z-0 -ml-8 h-72 w-36 rounded-t-full bg-violet-600">
        <div className="absolute left-10 top-14 flex gap-5">
          <div className="h-4 w-4 rounded-full bg-white" />
          <div className="h-4 w-4 rounded-full bg-white" />
        </div>
      </div>

      {/* Personagem preto */}
      <div className="relative z-20 -ml-6 h-64 w-32 rounded-t-[45%] bg-neutral-900">
        <div className="absolute left-7 top-10 flex gap-4">
          <div className="h-5 w-5 rounded-full bg-white" />
          <div className="h-5 w-5 rounded-full bg-white" />
        </div>
      </div>

      {/* Personagem amarelo */}
      <div className="relative z-30 -ml-8 h-56 w-36 rounded-t-full bg-yellow-400">
        <div className="absolute left-12 top-12 h-4 w-4 rounded-full bg-black" />

        <div className="absolute left-12 top-24 h-2 w-10 rounded-full bg-black" />
      </div>
    </div>
  );
}