/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { AuthAccountForm } from "@/components/auth/AuthAccountForm";

describe("AuthAccountForm", () => {
  it("shows a disconnect action and calls the handler when clicked", () => {
    const onDisconnect = jest.fn();

    render(
      <AuthAccountForm
        publicKey="GBTEST123"
        displayName=""
        isSignUpMode={true}
        isSubmitting={false}
        isLoading={false}
        error=""
        onDisplayNameChange={jest.fn()}
        onModeChange={jest.fn()}
        onSubmit={jest.fn()}
        onDisconnect={onDisconnect}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /disconnect wallet/i }));

    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });
});
