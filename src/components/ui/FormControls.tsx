type BaseFieldProps = {
  label: string;
  helpText?: string;
};

export function FormInput({ label, helpText, ...props }: BaseFieldProps & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={props.id ?? props.name}>{label}</label>
      <input {...props} id={props.id ?? props.name} />
      {helpText ? <p className="rounded-md bg-paperSoft px-2 py-1 text-xs leading-5 text-muted">{helpText}</p> : null}
    </div>
  );
}

export function FormTextarea({ label, helpText, ...props }: BaseFieldProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={props.id ?? props.name}>{label}</label>
      <textarea {...props} id={props.id ?? props.name} />
      {helpText ? <p className="rounded-md bg-paperSoft px-2 py-1 text-xs leading-5 text-muted">{helpText}</p> : null}
    </div>
  );
}

export function FormSelect({ label, helpText, children, ...props }: BaseFieldProps & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={props.id ?? props.name}>{label}</label>
      <select {...props} id={props.id ?? props.name}>
        {children}
      </select>
      {helpText ? <p className="rounded-md bg-paperSoft px-2 py-1 text-xs leading-5 text-muted">{helpText}</p> : null}
    </div>
  );
}
