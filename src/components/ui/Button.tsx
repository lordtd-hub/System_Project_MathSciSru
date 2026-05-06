type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
};

type LinkButtonProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: React.ReactNode;
};

export function PrimaryButton(props: ButtonProps) {
  return <button {...props} className={`button ${props.className ?? ""}`} />;
}

export function SecondaryButton(props: ButtonProps) {
  return <button {...props} className={`button-secondary ${props.className ?? ""}`} />;
}

export function DangerButton(props: ButtonProps) {
  return <button {...props} className={`button-danger ${props.className ?? ""}`} />;
}

export function PrimaryLinkButton(props: LinkButtonProps) {
  return <a {...props} className={`button ${props.className ?? ""}`} />;
}

export function SecondaryLinkButton(props: LinkButtonProps) {
  return <a {...props} className={`button-secondary ${props.className ?? ""}`} />;
}
