"use client";
import Image from "next/image";
import companylog from "./assets/logo.png";
import { useChat } from "ai/react";
import type { Message } from "ai";
import Bubble from "./components/Bubble";
import LoadingBubble from "./components/LoadingBubble";
import PromptSuggestionsRow from "./components/PromptSuggestionsRow";

const Home = () => {
  const {
    append,
    isLoading,
    input,
    handleInputChange,
    handleSubmit,
    messages,
  } = useChat({
    api: "/api/chat",
    streamProtocol: "text",
  });

  const noMessages = !messages || messages.length === 0;

  const handlePrompt = (promptText: string) => {
    const msg: Message = {
      id: crypto.randomUUID(),
      content: promptText,
      role: "user",
    };
    append(msg);
  };

  return (
    <main>
      <Image src={companylog} width={250} alt="companygpt" />

      <section className={noMessages ? "" : "populated"}>
        {noMessages ? (
          <>
            <p className="starter-text">
              Welcome to CompanyGPT! This is a private AI assistant for your
              company. Ask questions about the company and get answers in real
              time.
            </p>
            <br />
            <PromptSuggestionsRow onPromptClick={handlePrompt} />
          </>
        ) : (
          <>
            {messages.map((message, index) => (
              <Bubble key={`message-${index}`} message={message} />
            ))}
            {isLoading && <LoadingBubble />}
          </>
        )}
      </section>

      <form onSubmit={handleSubmit}>
        <input
          className="question-box"
          onChange={handleInputChange}
          value={input}
          placeholder="Ask a question..."
        />
        <input type="submit" />
      </form>
    </main>
  );
};

export default Home;
